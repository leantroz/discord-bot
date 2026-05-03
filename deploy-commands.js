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
      option.setName('timestamp')
        .setDescription('Código de timestamp de Discord, ej: <t:1777849200:R>')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Resetea la lista de inscripciones'),

  new SlashCommandBuilder()
    .setName('cerrar')
    .setDescription('Cierra la lista e impide nuevas inscripciones'),

  new SlashCommandBuilder()
    .setName('reabrir')
    .setDescription('Reabre la lista de inscripciones')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('Registrando comandos globales...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID), // ✅ Global
      { body: commands },
    );
    console.log('Comandos registrados globalmente.');
  } catch (error) {
    console.error(error);
  }
})();
