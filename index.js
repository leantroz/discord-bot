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
  await interaction.deferReply(); //  evita timeout

  const titulo = interaction.options.getString('titulo');
  const cantidad = interaction.options.getInteger('cantidad');
  const rolesInput = interaction.options.getString('roles').split(",");
  const tagRol = interaction.options.getRole('tag');
  const utcInput = interaction.options.getString('utc');
  const nota = interaction.options.getString('nota'); 
  const notaInferior = interaction.options.getString('nota_inferior'); 

  const utcTimestamp = utcInput ? parseUtcInput(utcInput) : null;
  if (utcInput && !utcTimestamp) {
    return interaction.editReply("Formato UTC inválido. Usa YYYY-MM-DD HH:mm o YYYY-MM-DDTHH:mm.");
  }

  if (rolesInput.length !== cantidad) {
    return interaction.editReply("La cantidad de roles no coincide con el número indicado.");
  }

  let listaRoles = {};
  rolesInput.forEach((rol, i) => listaRoles[i+1] = rol.trim());

  const descriptionLines = [];
  if (utcTimestamp) {
    const utcTime = formatUtcTimeFromTimestamp(utcTimestamp);
    descriptionLines.push(`**Timmer: ${utcTime} - <t:${utcTimestamp}:t>**`);
  }
  if (nota) descriptionLines.push(`**${nota}**`);

  const totalRoles = Object.keys(listaRoles).length;
  const occupied = 0;
  const estado = 'Abierto';

  //  Evitar descripción vacía
  const desc = descriptionLines.length > 0 ? descriptionLines.join("\n") : " ";

  const embed = new EmbedBuilder()
    .setTitle(`\u200B${titulo}\u200B`)
    .setColor(0x1F8BFF)
    .setDescription(desc)
    .setFooter({ 
      text: "Para pickear un rol, escribe el número correspondiente, si te equivocaste o queres cambiar de rol, deberás escribir: 'Liberar X(Numero que escogiste)'." 
    });

  embed.addFields(
    { name: '\u200B', value: '\u200B', inline: false },
    { name: 'Estado', value: `**${estado}**`, inline: true },
    { name: '\u200B', value: '\u200B', inline: true },
    { name: 'Cupos', value: `**${occupied}/${totalRoles}**`, inline: true },
  );

  // Dividir roles en partidas de 20
  const rolesArray = Object.entries(listaRoles);
  const rolesPerParty = 20;
  for (let i = 0; i < rolesArray.length; i += rolesPerParty) {
    const partyNum = Math.floor(i / rolesPerParty) + 1;
    const partyRoles = rolesArray.slice(i, i + rolesPerParty)
      .map(([num, rol]) => `${num}. **${rol.toUpperCase()} - (Vacante)**`).join("\n");
    embed.addFields({ name: `Party ${partyNum}`, value: partyRoles, inline: false });
  }
  if (notaInferior) {
    embed.addFields({ name: '\u200B', value: `**${notaInferior}**`, inline: false });
  }

  //  Usar editReply en lugar de replyOptions + fetchReply
  const sentMessage = await interaction.editReply({
    content: tagRol ? `<@&${tagRol.id}>` : undefined,
    embeds: [embed],
    allowedMentions: tagRol ? { roles: [tagRol.id] } : undefined
  });

  await sentMessage.startThread({ name: "Inscripciones", autoArchiveDuration: 60 });

  inscripciones[sentMessage.id] = {
    titulo,
    roles: listaRoles,
    jugadores: {},
    creador: interaction.user.id,
    cerrado: false,
    utcInput,
    utcTimestamp,
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
    const nuevoUtcInput = interaction.options.getString('utc');
    const nuevaNota = interaction.options.getString('nota');
    const nuevaNotaInferior = interaction.options.getString('nota_inferior'); 
    const rolesInput = interaction.options.getString('roles');
    const cantidad = interaction.options.getInteger('cantidad');

    const insc = inscripciones[mensajeId];
    if (!insc) return interaction.reply("No encontré esa inscripción.");
    if (interaction.user.id !== insc.creador) {
      return interaction.reply("Solo el creador puede editar esta inscripción.");
    }

    const nuevoUtcTimestamp = nuevoUtcInput ? parseUtcInput(nuevoUtcInput) : null;
    if (nuevoUtcInput && !nuevoUtcTimestamp) {
      return interaction.reply("Formato UTC inválido. Usa YYYY-MM-DD HH:mm o YYYY-MM-DDTHH:mm.");
    }

  // =========================
  // ACTUALIZAR DATOS
  // =========================
    if (nuevoTitulo) insc.titulo = nuevoTitulo;
    if (nuevoUtcInput) {
      insc.utcInput = nuevoUtcInput;
      insc.utcTimestamp = nuevoUtcTimestamp;
    }
    if (nuevaNota) insc.nota = nuevaNota;
    if (nuevaNotaInferior) insc.notaInferior = nuevaNotaInferior; 
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

  // =========================
  // LIBERAR ROL
  // =========================
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

  // =========================
  // INSCRIPCION
  // =========================
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
  const descriptionLines = [];
  if (data.utcTimestamp) {
    const utcTime = formatUtcTimeFromTimestamp(data.utcTimestamp);
    descriptionLines.push(`**Timmer: ${utcTime} - <t:${data.utcTimestamp}:t>**`);
  }
  if (data.utcTimestamp && data.nota) descriptionLines.push("");
  if (data.nota) descriptionLines.push(`**${data.nota}**`);

  const totalRoles = Object.keys(data.roles).length;
  const occupied = Object.keys(data.jugadores).length;
  const estado = data.cerrado ? 'Cerrado' : 'Abierto';
  if (data.nota) descriptionLines.push("");

  const embed = new EmbedBuilder()
    .setTitle(`\u200B${data.titulo || "Inscripciones"}\u200B`)
    .setColor(0x1F8BFF)
    .setDescription(descriptionLines.join("\n"))
    .setFooter({ text: "Para pickear un rol, escribe el número correspondiente, si te equivocaste o queres cambiar de rol, deberás escribir: 'Liberar X(Numero que escogiste)'." });

  embed.addFields(
    { name: '\u200B', value: '\u200B', inline: false },
    { name: 'Estado', value: `**${estado}**`, inline: true },
    { name: '\u200B', value: '\u200B', inline: true },
    { name: 'Cupos', value: `**${occupied}/${totalRoles}**`, inline: true },
  );

  
// =========================
// DIVIR ROL EN PARTYS DE 20
// =========================
  const rolesArray = Object.entries(data.roles);
  const rolesPerParty = 20;
  for (let i = 0; i < rolesArray.length; i += rolesPerParty) {
    const partyNum = Math.floor(i / rolesPerParty) + 1;
    const partyRoles = rolesArray.slice(i, i + rolesPerParty)
      .map(([num, rol]) => {
        const jugador = data.jugadores[num];
        return `${num}. **${rol.toUpperCase()} - ${jugador ? `<@${jugador.id}>` : "(Vacante)"}**`;
      }).join("\n");
    embed.addFields({ name: `Party ${partyNum}`, value: partyRoles, inline: false });
  }
  if (data.notaInferior) {
    embed.addFields({ name: '\u200B', value: `**${data.notaInferior}**`, inline: false });
  }

  await parentMessage.edit({ embeds: [embed] });
}

function formatUtcTimeFromTimestamp(timestamp) {
  const date = new Date(timestamp * 1000);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes} UTC`;
}

function parseUtcInput(input) {
  const normalized = input.trim().replace(/\s+/g, 'T');
  const isoMatch = normalized.match(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/);
  if (!isoMatch) return null;

  const date = new Date(`${normalized}Z`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

client.login(process.env.TOKEN);
