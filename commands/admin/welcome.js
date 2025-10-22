const {
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
} = require('discord.js');
const Welcome = require('../../models/welcome');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure the welcome system')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle')
        .setDescription('Enable or disable the welcome system')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('description')
        .setDescription('Set the custom welcome message description')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setchannel')
        .setDescription('Set the welcome channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The channel to send welcome messages')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('test')
        .setDescription('Preview the current welcome message')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set-embed-color')
        .setDescription('Set the embed color for welcome messages')
        .addStringOption((option) =>
          option
            .setName('color')
            .setDescription('Hex color code (e.g., #00BFFF)')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle-leave')
        .setDescription('Enable or disable the leave system')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set-leave-description')
        .setDescription('Set the custom leave message description')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set-leave-channel')
        .setDescription('Set the leave channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The channel to send leave messages')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('test-leave')
        .setDescription('Preview the current leave message')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set-leave-embed-color')
        .setDescription('Set the embed color for leave messages')
        .addStringOption((option) =>
          option
            .setName('color')
            .setDescription('Hex color code (e.g., #FF5733)')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        content:
          'You do not have the `Administrator` permission to manage the welcome system!',
        ephemeral: true,
      });
    }
    const { options, guild, user } = interaction;
    const serverId = guild.id;
    const subcommand = options.getSubcommand();

    let welcome = await Welcome.findOne({ serverId });

    if (!welcome) {
      welcome = new Welcome({ serverId });
      await welcome.save();
    }

    if (subcommand === 'toggle') {
      welcome.enabled = !welcome.enabled;
      await welcome.save();
      const toggleEmbed = new EmbedBuilder()
        .setColor(welcome.enabled ? '#4CAF50' : '#FF5733')
        .setTitle('Welcome System')
        .setDescription(
          `The welcome system is now ${welcome.enabled ? 'enabled' : 'disabled'}. \n\n __**Note:** Please set the channel for sending the welcome greetings by using \`/welcome setchannel\`__`
        )
        .setTimestamp();
      return interaction.reply({ embeds: [toggleEmbed] });
    }

    if (subcommand === 'description') {
      if (!welcome.enabled) {
        return interaction.reply({
          content: 'The Welcome System is not enabled in this server!',
        });
      }
      const descriptionEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('Set Custom Welcome Message')
        .setDescription(
          '**Please provide your custom welcome message. You can use the following placeholders:**\n\n' +
            "`{member}` - Member's username\n" +
            '`{server}` - Server name\n' +
            '`{serverid}` - Server ID\n' +
            '`{userid}` - User ID\n' +
            '`{joindate}` - Join date\n' +
            '`{accountage}` - Account age\n' +
            '`{membercount}` - Member count\n' +
            '`{serverage}` - Server age (in days)\n\n' +
            '__**Note:** This command will expire in 5 minutes__'
        )
        .setTimestamp();

      await interaction.reply({
        embeds: [descriptionEmbed],
        ephemeral: true,
      });

      const filter = (response) => response.author.id === user.id;
      const collector = interaction.channel.createMessageCollector({
        filter,
        time: 300000,
      });

      collector.on('collect', async (message) => {
        const customDescription = message.content;

        welcome.description = customDescription;
        await welcome.save();

        const successEmbed = new EmbedBuilder()
          .setColor('#4CAF50')
          .setTitle('Custom Welcome Message Set')
          .setDescription(
            `Your welcome message has been updated to:\n${customDescription}`
          )
          .setTimestamp();
        interaction.followUp({
          embeds: [successEmbed],
          ephemeral: true,
        });

        collector.stop();
      });

      collector.on('end', (collected, reason) => {
        if (reason === 'time') {
          const timeoutEmbed = new EmbedBuilder()
            .setColor('#FF5733')
            .setTitle('Timeout')
            .setDescription(
              'You took too long to provide a description. Please try again.'
            )
            .setTimestamp();
          interaction.followUp({
            embeds: [timeoutEmbed],
            ephemeral: true,
          });
        }
      });
    }

    if (subcommand === 'setchannel') {
      if (!welcome.enabled) {
        return interaction.reply({
          content: 'The Welcome System is not enabled in this server!',
        });
      }
      const channel = interaction.options.getChannel('channel');

      welcome.channelId = channel.id;
      await welcome.save();

      const channelEmbed = new EmbedBuilder()
        .setColor('#4CAF50')
        .setTitle('Welcome Channel Set')
        .setDescription(`The welcome channel has been set to ${channel}.`)
        .setTimestamp();
      return interaction.reply({
        embeds: [channelEmbed],
        ephemeral: true,
      });
    }

    if (subcommand === 'test') {
      if (!welcome.enabled) {
        return interaction.reply({
          content: 'The Welcome System is not enabled in this server!',
        });
      }
      const memberCount = guild.memberCount;

      let description = welcome.description || 'Welcome {member} to {server}';
      description = description
        .replace(/{member}/g, interaction.user)
        .replace(/{server}/g, guild.name)
        .replace(/{serverid}/g, guild.id)
        .replace(/{userid}/g, user.id)
        .replace(/{joindate}/g, `<t:${Math.floor(Date.now() / 1000)}:F>`)
        .replace(/{accountage}/g, `<t:${Math.floor(user.createdAt / 1000)}:R>`)
        .replace(/{membercount}/g, memberCount)
        .replace(/{serverage}/g, `<t:${Math.floor(guild.createdAt / 1000)}:R>`);

      const testEmbed = new EmbedBuilder()
        .setColor(welcome.embedColor || '#00BFFF')
        .setTitle('Welcome Message Preview')
        .setDescription(description)
        .setFooter({
          text: 'This is how the welcome message will look like when a member joins.',
        })
        .setTimestamp();

      return interaction.reply({ embeds: [testEmbed], ephemeral: true });
    }

    if (subcommand === 'set-embed-color') {
      if (!welcome.enabled) {
        return interaction.reply({
          content: 'The Welcome System is not enabled in this server!',
        });
      }
      const color = interaction.options.getString('color');

      // Validate hex color
      if (!/^#[0-9A-F]{6}$/i.test(color)) {
        return interaction.reply({
          content: 'Please provide a valid hex color code (e.g., #00BFFF).',
          ephemeral: true,
        });
      }

      welcome.embedColor = color;
      await welcome.save();

      const colorEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle('Welcome Embed Color Set')
        .setDescription(`The welcome embed color has been set to ${color}.`)
        .setTimestamp();
      return interaction.reply({
        embeds: [colorEmbed],
        ephemeral: true,
      });
    }

    if (subcommand === 'toggle-leave') {
      welcome.leaveEnabled = !welcome.leaveEnabled;
      await welcome.save();
      const toggleEmbed = new EmbedBuilder()
        .setColor(welcome.leaveEnabled ? '#4CAF50' : '#FF5733')
        .setTitle('Leave System')
        .setDescription(
          `The leave system is now ${welcome.leaveEnabled ? 'enabled' : 'disabled'}. \n\n __**Note:** Please set the channel for sending the leave messages by using \`/welcome set-leave-channel\`__`
        )
        .setTimestamp();
      return interaction.reply({ embeds: [toggleEmbed] });
    }

    if (subcommand === 'set-leave-description') {
      if (!welcome.leaveEnabled) {
        return interaction.reply({
          content: 'The Leave System is not enabled in this server!',
        });
      }
      const descriptionEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('Set Custom Leave Message')
        .setDescription(
          '**Please provide your custom leave message. You can use the following placeholders:**\n\n' +
            "`{member}` - Member's username\n" +
            '`{server}` - Server name\n' +
            '`{serverid}` - Server ID\n' +
            '`{userid}` - User ID\n' +
            '`{joindate}` - Join date\n' +
            '`{accountage}` - Account age\n' +
            '`{membercount}` - Member count\n' +
            '`{serverage}` - Server age (in days)\n\n' +
            '__**Note:** This command will expire in 5 minutes__'
        )
        .setTimestamp();

      await interaction.reply({
        embeds: [descriptionEmbed],
        ephemeral: true,
      });

      const filter = (response) => response.author.id === user.id;
      const collector = interaction.channel.createMessageCollector({
        filter,
        time: 300000,
      });

      collector.on('collect', async (message) => {
        const customDescription = message.content;

        welcome.leaveDescription = customDescription;
        await welcome.save();

        const successEmbed = new EmbedBuilder()
          .setColor('#4CAF50')
          .setTitle('Custom Leave Message Set')
          .setDescription(
            `Your leave message has been updated to:\n${customDescription}`
          )
          .setTimestamp();
        interaction.followUp({
          embeds: [successEmbed],
          ephemeral: true,
        });

        collector.stop();
      });

      collector.on('end', (collected, reason) => {
        if (reason === 'time') {
          const timeoutEmbed = new EmbedBuilder()
            .setColor('#FF5733')
            .setTitle('Timeout')
            .setDescription(
              'You took too long to provide a description. Please try again.'
            )
            .setTimestamp();
          interaction.followUp({
            embeds: [timeoutEmbed],
            ephemeral: true,
          });
        }
      });
    }

    if (subcommand === 'set-leave-channel') {
      if (!welcome.leaveEnabled) {
        return interaction.reply({
          content: 'The Leave System is not enabled in this server!',
        });
      }
      const channel = interaction.options.getChannel('channel');

      welcome.leaveChannelId = channel.id;
      await welcome.save();

      const channelEmbed = new EmbedBuilder()
        .setColor('#4CAF50')
        .setTitle('Leave Channel Set')
        .setDescription(`The leave channel has been set to ${channel}.`)
        .setTimestamp();
      return interaction.reply({
        embeds: [channelEmbed],
        ephemeral: true,
      });
    }

    if (subcommand === 'test-leave') {
      if (!welcome.leaveEnabled) {
        return interaction.reply({
          content: 'The Leave System is not enabled in this server!',
        });
      }
      const memberCount = guild.memberCount;

      let description = welcome.leaveDescription || '{member} has left {server}';
      description = description
        .replace(/{member}/g, interaction.user)
        .replace(/{server}/g, guild.name)
        .replace(/{serverid}/g, guild.id)
        .replace(/{userid}/g, user.id)
        .replace(/{joindate}/g, `<t:${Math.floor(Date.now() / 1000)}:F>`)
        .replace(/{accountage}/g, `<t:${Math.floor(user.createdAt / 1000)}:R>`)
        .replace(/{membercount}/g, memberCount)
        .replace(/{serverage}/g, `<t:${Math.floor(guild.createdAt / 1000)}:R>`);

      const testEmbed = new EmbedBuilder()
        .setColor(welcome.leaveEmbedColor || '#FF5733')
        .setTitle('Leave Message Preview')
        .setDescription(description)
        .setFooter({
          text: 'This is how the leave message will look like when a member leaves.',
        })
        .setTimestamp();

      return interaction.reply({ embeds: [testEmbed], ephemeral: true });
    }

    if (subcommand === 'set-leave-embed-color') {
      if (!welcome.leaveEnabled) {
        return interaction.reply({
          content: 'The Leave System is not enabled in this server!',
        });
      }
      const color = interaction.options.getString('color');

      // Validate hex color
      if (!/^#[0-9A-F]{6}$/i.test(color)) {
        return interaction.reply({
          content: 'Please provide a valid hex color code (e.g., #FF5733).',
          ephemeral: true,
        });
      }

      welcome.leaveEmbedColor = color;
      await welcome.save();

      const colorEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle('Leave Embed Color Set')
        .setDescription(`The leave embed color has been set to ${color}.`)
        .setTimestamp();
      return interaction.reply({
        embeds: [colorEmbed],
        ephemeral: true,
      });
    }
  },
};
