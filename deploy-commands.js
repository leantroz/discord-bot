require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('inscripciones')
    .setDescription('Crea una lista de inscripciones')
    .addStringOption(option =>
      option.setName('titulo')
        .setDescription('Título del embed')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad de roles')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('roles')
        .setDescription('Lista de roles separados por coma')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('tag')
        .setDescription('Rol a mencionar')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('utc')
        .setDescription('Horario en UTC (YYYY-MM-DD HH:mm o YYYY-MM-DDTHH:mm)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('nota')
        .setDescription('Texto adicional antes del footer (se mostrará en negrita)')
        .setRequired(false))
        .addStringOption(option =>
  option.setName('nota_inferior')
    .setDescription('Texto adicional en negrita arriba del footer')
    .setRequired(false)),

  new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Resetea la lista de inscripciones'),

  new SlashCommandBuilder()
    .setName('cerrar')
    .setDescription('Cierra la lista e impide nuevas inscripciones'),

  new SlashCommandBuilder()
    .setName('reabrir')
    .setDescription('Reabre la lista de inscripciones'),

  // comando para editar el embed
  new SlashCommandBuilder()
    .setName('editar_inscripcion')
    .setDescription('Editar un embed de inscripciones ya enviado')
    .addStringOption(opt =>
      opt.setName('mensaje_id')
        .setDescription('ID del mensaje original')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('titulo')
        .setDescription('Nuevo título')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('utc')
        .setDescription('Nuevo horario UTC (YYYY-MM-DD HH:mm o YYYY-MM-DDTHH:mm)')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('nota')
        .setDescription('Nueva nota')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('nota_inferior')
        .setDescription('Nueva nota inferior')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('roles')
        .setDescription('Lista de roles separados por coma')
        .setRequired(false))
    .addIntegerOption(opt =>
      opt.setName('cantidad')
        .setDescription('Cantidad de roles')
        .setRequired(false))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    if (!process.env.GUILD_ID) {
      throw new Error('Falta la variable de entorno GUILD_ID. Añade el ID del servidor específico.');
    }

    console.log('Registrando comandos en el servidor específico...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      //  Routes.applicationGuildCommands(process.env.CLIENT_ID),
      { body: commands },
    );
    console.log('Comandos registrados en el servidor específico.');
  } catch (error) {
    console.error(error);
  }
})();
