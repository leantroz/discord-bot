require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('Reseteando comandos de guild...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: [] } // ✅ esto borra todos los comandos de ese servidor
    );
    console.log('Comandos de guild reseteados.');
  } catch (error) {
    console.error(error);
  }
})();
