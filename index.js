require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let inscripciones = {};

client.once('ready', () => {
  console.log(`Bot iniciado como ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // =========================
  // CREAR INSCRIPCIONES
  // =========================
  if (interaction.commandName === 'inscripciones') {
    const titulo = interaction.options.getString('titulo');
    const cantidad = interaction.options.getInteger('cantidad');
    const rolesInput = interaction.options.getString('roles').split(",");
    const tagRol = interaction.options.getRole('tag');
    const timestampCode = interaction.options.getString('timestamp');
    const nota = interaction.options.getString('nota'); // nota superior
  const notaInferior = interaction.options.getString('nota_inferior'); // nota inferior


    if (rolesInput.length !== cantidad) {
      return interaction.reply("La cantidad de roles no coincide con el número indicado.");
    }

    let listaRoles = {};
    rolesInput.forEach((rol, i) => listaRoles[i+1] = rol.trim());

    let descripcion = "";
  if (timestampCode) descripcion += `${timestampCode}\n`;
  if (nota) descripcion += `**${nota}**\n\n`;

    descripcion += Object.entries(listaRoles)
  .map(([num, rol]) => `${num}. ${rol} - (vacante)`)
  .join("\n");

//  Nota inferior justo arriba del footer
    if (notaInferior) {
    descripcion += `\n\n**${notaInferior}**`;
}


    const embed = new EmbedBuilder()
      .setTitle(titulo)
      .setDescription(descripcion)
      .setFooter({ text: "Si queres cambiar de rol y ya estás inscripto en otro, liberalo primero escribiendo: 'Liberar + (Numero que queres liberar) Ejemplo: Liberar 2'." });

    const content = tagRol ? `<@&${tagRol.id}>` : null;

    const sentMessage = await interaction.reply({
      content,
      embeds: [embed],
      fetchReply: true,
      allowedMentions: { roles: tagRol ? [tagRol.id] : [] }
    });

    await sentMessage.startThread({ name: "Inscripciones", autoArchiveDuration: 60 });

    inscripciones[sentMessage.id] = { 
     titulo,
    roles: listaRoles, 
    jugadores: {}, 
    creador: interaction.user.id, 
    cerrado: false,
    timestamp: timestampCode,
    nota,
    notaInferior
};

  }

  // =========================
  // EDITAR INSCRIPCIONES
  // =========================
  if (interaction.commandName === 'editar_inscripcion') {
    const mensajeId = interaction.options.getString('mensaje_id');
    const nuevoTitulo = interaction.options.getString('titulo');
    const nuevoTimestamp = interaction.options.getString('timestamp');
    const nuevaNota = interaction.options.getString('nota');
    const rolesInput = interaction.options.getString('roles');
    const cantidad = interaction.options.getInteger('cantidad');

    const insc = inscripciones[mensajeId];
    if (!insc) return interaction.reply("No encontré esa inscripción.");
    if (interaction.user.id !== insc.creador) {
      return interaction.reply("Solo el creador puede editar esta inscripción.");
    }

    // Actualizar datos
    if (nuevoTitulo) insc.titulo = nuevoTitulo;
    if (nuevoTimestamp) insc.timestamp = nuevoTimestamp;
    if (nuevaNota) insc.nota = nuevaNota;
    if (rolesInput && cantidad) {
      const rolesArray = rolesInput.split(",");
      if (rolesArray.length !== cantidad) {
        return interaction.reply("La cantidad de roles no coincide con el número indicado.");
      }
      insc.roles = {};
      rolesArray.forEach((rol, i) => insc.roles[i+1] = rol.trim());
    }

    await actualizarEmbed(await interaction.channel.messages.fetch(mensajeId), insc);
    return interaction.reply("Inscripción actualizada.");
  }

  // =========================
  // RESET / CERRAR / REABRIR
  // =========================
  if (interaction.commandName === 'reset') {
    const thread = interaction.channel;
    if (!thread.isThread()) return interaction.reply("Este comando solo funciona dentro del hilo de inscripciones.");
    const parentMessage = await thread.fetchStarterMessage();
    const data = inscripciones[parentMessage.id];
    if (!data) return interaction.reply("No hay inscripciones activas.");
    if (interaction.user.id !== data.creador) return interaction.reply("Solo el creador puede resetear la lista.");

    data.jugadores = {};
    await actualizarEmbed(parentMessage, data);
    return interaction.reply("La lista ha sido reseteada.");
  }

  if (interaction.commandName === 'cerrar') {
    const thread = interaction.channel;
    if (!thread.isThread()) return interaction.reply("Este comando solo funciona dentro del hilo de inscripciones.");
    const parentMessage = await thread.fetchStarterMessage();
    const data = inscripciones[parentMessage.id];
    if (!data) return interaction.reply("No hay inscripciones activas.");
    if (interaction.user.id !== data.creador) return interaction.reply("Solo el creador puede cerrar la lista.");

    data.cerrado = true;
    return interaction.reply("La lista ha sido cerrada. No se aceptan más inscripciones.");
  }

  if (interaction.commandName === 'reabrir') {
    const thread = interaction.channel;
    if (!thread.isThread()) return interaction.reply("Este comando solo funciona dentro del hilo de inscripciones.");
    const parentMessage = await thread.fetchStarterMessage();
    const data = inscripciones[parentMessage.id];
    if (!data) return interaction.reply("No hay inscripciones activas.");
    if (interaction.user.id !== data.creador) return interaction.reply("Solo el creador puede reabrir la lista.");

    data.cerrado = false;
    return interaction.reply("La lista ha sido reabierta. Ya se aceptan inscripciones nuevamente.");
  }
});

client.on('messageCreate', async (message) => {
  if (message.channel.isThread()) {
    const parentMessage = await message.channel.fetchStarterMessage();
    const data = inscripciones[parentMessage.id];
    if (!data || data.cerrado) return;

    const contenido = message.content.trim().toLowerCase();

    // Liberar lugar
    if (contenido.startsWith("liberar")) {
      const numero = parseInt(contenido.split(" ")[1]);
      if (data.jugadores[numero]?.id === message.author.id) {
        delete data.jugadores[numero];
        await actualizarEmbed(parentMessage, data);
        return message.reply(`Has liberado el rol ${numero}.`);
      } else {
        return message.reply("No estás en ese rol o ese número de rol no existe.");
      }
    }

    // Inscripción
    const numero = parseInt(contenido);
    if (!isNaN(numero)) {
      if (data.roles[numero]) {
        if (data.jugadores[numero]) {
          return message.reply("Ese lugar ya está ocupado.");
        }
        const yaInscripto = Object.values(data.jugadores).find(u => u.id === message.author.id);
        if (yaInscripto) {
          return message.reply("Ya estás inscripto en otro rol. Liberalo primero escribiendo:'Liberar + (Numero que queres liberar) Ejemplo: Liberar 2' si querés cambiar.");
        }
        data.jugadores[numero] = message.author;
        await actualizarEmbed(parentMessage, data);
        return message.reply(`Te inscribiste en el lugar ${numero}.`);
      } else {
        return message.reply("Por favor, inscribite en un rol válido");
      }
    }
  }
});

async function actualizarEmbed(parentMessage, data) {
  let descripcion = "";
  if (data.timestamp) descripcion += `${data.timestamp}\n`;
  if (data.nota) descripcion += `**${data.nota}**\n\n`;

    descripcion += Object.entries(data.roles)
  .map(([num, rol]) => {
    const jugador = data.jugadores[num];
    return `${num}. ${rol} - ${jugador ? `<@${jugador.id}>` : "(vacante)"}`;
  }).join("\n");

  if (data.notaInferior) {
    descripcion += `\n\n**${data.notaInferior}**`;
}

  const embed = new EmbedBuilder()
    .setTitle(data.titulo || "Inscripciones")
    .setDescription(descripcion)
    .setFooter({ text: "Si queres cambiar de rol y ya estás inscripto en otro, liberalo primero escribiendo: 'Liberar + (Numero que queres liberar) Ejemplo: Liberar 2'." });

  await parentMessage.edit({ embeds: [embed] });
}

client.login(process.env.TOKEN);
