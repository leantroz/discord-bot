require("dotenv").config();
const fs = require("node:fs");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const PATH_ARCHIVO = "./inscripciones.txt";

// Cargar datos al iniciar
let inscripciones = cargarDatos();

function cargarDatos() {
  if (fs.existsSync(PATH_ARCHIVO)) {
    try {
      const data = fs.readFileSync(PATH_ARCHIVO, "utf8");
      return JSON.parse(data);
    } catch (error) {
      console.error("Error al leer el archivo de inscripciones:", error);
      return {};
    }
  }
  return {};
}

function guardarDatos() {
  try {
    fs.writeFileSync(
      PATH_ARCHIVO,
      JSON.stringify(inscripciones, null, 2),
      "utf8",
    );
  } catch (error) {
    console.error("Error al guardar el archivo de inscripciones:", error);
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Bot iniciado como ${readyClient.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // =========================
  // CREAR INSCRIPCIONES
  // =========================
  if (interaction.commandName === "inscripciones") {
    const titulo = interaction.options.getString("titulo");
    const cantidad = interaction.options.getInteger("cantidad");
    const rolesInput = interaction.options.getString("roles").split(",");
    const tagRol = interaction.options.getRole("tag");
    const timestampCode = interaction.options.getString("timestamp");
    const nota = interaction.options.getString("nota"); // nota superior
    const notaInferior = interaction.options.getString("nota_inferior"); // nota inferior

    if (rolesInput.length !== cantidad) {
      return interaction.reply(
        "La cantidad de roles no coincide con el número indicado.",
      );
    }

    let listaRoles = {};
    rolesInput.forEach((rol, i) => (listaRoles[i + 1] = rol.trim()));

    const descriptionLines = [];
    if (timestampCode) descriptionLines.push(`**${timestampCode}**`);
    if (nota) descriptionLines.push(`**${nota}**`);
    if (timestampCode || nota) descriptionLines.push("", "");
    descriptionLines.push(
      ...Object.entries(listaRoles).map(
        ([num, rol]) => `${num}. ${rol} - (Vacante)`,
      ),
    );
    if (notaInferior) descriptionLines.push("", `**${notaInferior}**`);

    const embed = new EmbedBuilder()
      .setTitle(titulo)
      .setColor(0x1f8bff)
      .setDescription(descriptionLines.join("\n"))
      .setFooter({
        text: "Para pickear un rol, escribe el número correspondiente, si te equivocaste o queres cambiar de rol, deberás escribir: 'Liberar X(Numero que escogiste)'.",
      });

    const content = tagRol ? `<@&${tagRol.id}>` : null;

    const sentMessage = await interaction.reply({
      content,
      embeds: [embed],
      fetchReply: true,
      allowedMentions: { roles: tagRol ? [tagRol.id] : [] },
    });

    await sentMessage.startThread({
      name: "Inscripciones",
      autoArchiveDuration: 60,
    });

    inscripciones[sentMessage.id] = {
      titulo,
      roles: listaRoles,
      jugadores: {},
      creador: interaction.user.id,
      cerrado: false,
      timestamp: timestampCode,
      nota,
      notaInferior,
    };
    guardarDatos();
  }

  // =========================
  // EDITAR INSCRIPCIONES
  // =========================
  if (interaction.commandName === "editar_inscripcion") {
    const mensajeId = interaction.options.getString("mensaje_id");
    const nuevoTitulo = interaction.options.getString("titulo");
    const nuevoTimestamp = interaction.options.getString("timestamp");
    const nuevaNota = interaction.options.getString("nota");
    const nuevaNotaInferior = interaction.options.getString("nota_inferior"); // ✅ nueva opción
    const rolesInput = interaction.options.getString("roles");
    const cantidad = interaction.options.getInteger("cantidad");

    const insc = inscripciones[mensajeId];
    if (!insc) return interaction.reply("No encontré esa inscripción.");
    if (interaction.user.id !== insc.creador) {
      return interaction.reply(
        "Solo el creador puede editar esta inscripción.",
      );
    }

    // Actualizar datos
    if (nuevoTitulo) insc.titulo = nuevoTitulo;
    if (nuevoTimestamp) insc.timestamp = nuevoTimestamp;
    if (nuevaNota) insc.nota = nuevaNota;
    if (nuevaNotaInferior) insc.notaInferior = nuevaNotaInferior; // ✅ actualiza nota inferior
    if (rolesInput && cantidad) {
      const rolesArray = rolesInput.split(",");
      if (rolesArray.length !== cantidad) {
        return interaction.reply(
          "La cantidad de roles no coincide con el número indicado.",
        );
      }
      insc.roles = {};
      rolesArray.forEach((rol, i) => (insc.roles[i + 1] = rol.trim()));
    }

    await actualizarEmbed(
      await interaction.channel.messages.fetch(mensajeId),
      insc,
    );
    guardarDatos();
    return interaction.reply("Inscripción actualizada.");
  }

  // =========================
  // RESET / CERRAR / REABRIR
  // =========================
  if (interaction.commandName === "reset") {
    const thread = interaction.channel;
    if (!thread.isThread())
      return interaction.reply(
        "Este comando solo funciona dentro del hilo de inscripciones.",
      );
    const parentMessage = await thread.fetchStarterMessage();
    const data = inscripciones[parentMessage.id];
    if (!data) return interaction.reply("No hay inscripciones activas.");
    if (interaction.user.id !== data.creador)
      return interaction.reply("Solo el creador puede resetear la lista.");

    data.jugadores = {};
    guardarDatos();
    await actualizarEmbed(parentMessage, data);
    return interaction.reply("La lista ha sido reseteada.");
  }

  if (interaction.commandName === "cerrar") {
    const thread = interaction.channel;
    if (!thread.isThread())
      return interaction.reply(
        "Este comando solo funciona dentro del hilo de inscripciones.",
      );
    const parentMessage = await thread.fetchStarterMessage();
    const data = inscripciones[parentMessage.id];
    if (!data) return interaction.reply("No hay inscripciones activas.");
    if (interaction.user.id !== data.creador)
      return interaction.reply("Solo el creador puede cerrar la lista.");

    data.cerrado = true;
    guardarDatos();
    return interaction.reply(
      "La lista ha sido cerrada. No se aceptan más inscripciones.",
    );
  }

  if (interaction.commandName === "reabrir") {
    const thread = interaction.channel;
    if (!thread.isThread())
      return interaction.reply(
        "Este comando solo funciona dentro del hilo de inscripciones.",
      );
    const parentMessage = await thread.fetchStarterMessage();
    const data = inscripciones[parentMessage.id];
    if (!data) return interaction.reply("No hay inscripciones activas.");
    if (interaction.user.id !== data.creador)
      return interaction.reply("Solo el creador puede reabrir la lista.");

    data.cerrado = false;
    guardarDatos();
    return interaction.reply(
      "La lista ha sido reabierta. Ya se aceptan inscripciones nuevamente.",
    );
  }
});

client.on("messageCreate", async (message) => {
  // Ignorar bots para evitar bucles y solo procesar hilos
  if (message.author.bot || !message.channel.isThread()) return;

  try {
    const parentMessage = await message.channel.fetchStarterMessage();
    if (!parentMessage) return;

    const data = inscripciones[parentMessage.id];
    if (!data || data.cerrado) return;

    const contenido = message.content.trim().toLowerCase();

    // Liberar lugar
    if (contenido.startsWith("liberar")) {
      const numero = parseInt(contenido.split(" ")[1]);
      if (data.jugadores[numero]?.id === message.author.id) {
        delete data.jugadores[numero];
        guardarDatos();
        await actualizarEmbed(parentMessage, data);
        return message.reply(`Has liberado el rol ${numero}.`);
      } else {
        return message.reply(
          "No estás en ese rol o ese número de rol no existe.",
        );
      }
    }

    // Inscripción
    const numero = parseInt(contenido);
    if (!isNaN(numero)) {
      if (data.roles[numero]) {
        if (data.jugadores[numero]) {
          return message.reply("Ese lugar ya está ocupado.");
        }
        const yaInscripto = Object.values(data.jugadores).find(
          (u) => u.id === message.author.id,
        );
        if (yaInscripto) {
          return message.reply(
            "Ya estás inscripto en otro rol. Liberalo primero escribiendo:'Liberar + (Numero que queres liberar) Ejemplo: Liberar 2' si querés cambiar.",
          );
        }
        data.jugadores[numero] = message.author;
        guardarDatos();
        await actualizarEmbed(parentMessage, data);
        return message.reply(`Te inscribiste en el lugar ${numero}.`);
      } else {
        return message.reply("Por favor, inscribite en un rol válido");
      }
    }
  } catch (error) {
    console.error("Error procesando mensaje en hilo:", error);
  }
});

async function actualizarEmbed(parentMessage, data) {
  const descriptionLines = [];
  if (data.timestamp) descriptionLines.push(`**${data.timestamp}**`);
  if (data.nota) descriptionLines.push(`**${data.nota}**`);
  if (data.timestamp || data.nota) descriptionLines.push("", "");
  descriptionLines.push(
    ...Object.entries(data.roles).map(([num, rol]) => {
      const jugador = data.jugadores[num];
      return `${num}. ${rol} - ${jugador ? `<@${jugador.id}>` : "(Vacante)"}`;
    }),
  );
  if (data.notaInferior) descriptionLines.push("", `**${data.notaInferior}**`);

  const embed = new EmbedBuilder()
    .setTitle(data.titulo || "Inscripciones")
    .setColor(0x1f8bff)
    .setDescription(descriptionLines.join("\n"))
    .setFooter({
      text: "Para pickear un rol, escribe el número correspondiente, si te equivocaste o queres cambiar de rol, deberás escribir: 'Liberar X(Numero que escogiste)'.",
    });

  await parentMessage.edit({ embeds: [embed] });
}

client.login(process.env.TOKEN);
