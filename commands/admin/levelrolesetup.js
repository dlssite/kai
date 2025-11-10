const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
} = require('discord.js');
const { GuildSettings, LevelRoles } = require('../../models/Level');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('levelrolesetup')
    .setDescription('Interactive dashboard to manage level roles')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('view')
        .setDescription('View currently configured level roles')
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        content: 'You do not have `Administrator` permission to manage level roles!',
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'view') {
      await this.handleViewRoles(interaction);
    } else {
      // Original interactive dashboard for setup
      await this.handleSetupDashboard(interaction);
    }
  },

  async handleViewRoles(interaction) {
    const guildData = await GuildSettings.findOne({
      guildId: interaction.guild.id,
    });

    if (!guildData || !guildData.levelingEnabled) {
      return interaction.reply({
        content: 'Leveling system is not enabled in this server.',
        ephemeral: true,
      });
    }

    const levelRoles = await LevelRoles.find({
      guildId: interaction.guild.id,
    }).sort({ level: 1 });

    const embed = new EmbedBuilder()
      .setTitle('Configured Level Roles')
      .setColor('Blue')
      .setTimestamp();

    if (levelRoles.length === 0) {
      embed.setDescription('No level roles have been configured for this server.');
    } else {
      const fields = levelRoles.map(r => ({
        name: `Level ${r.level}`,
        value: `<@&${r.roleId}>`,
        inline: true,
      }));
      embed.addFields(fields);
    }

    embed.addFields({
      name: 'Stackable Roles',
      value: guildData.stackable ? 'Enabled' : 'Disabled',
      inline: false,
    });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },

  async handleSetupDashboard(interaction) {
    const guildData = await GuildSettings.findOne({
      guildId: interaction.guild.id,
    });

    if (!guildData || !guildData.levelingEnabled) {
      return interaction.reply({
        content: 'Leveling system is not enabled in this server.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const levelRoles = await LevelRoles.find({
      guildId: interaction.guild.id,
    }).sort({ level: 1 });

    const embed = new EmbedBuilder()
      .setTitle('Level Role Setup Dashboard')
      .setDescription('Manage roles assigned at specific levels.')
      .setColor('Blue')
      .addFields(
        {
          name: 'Current Level Roles',
          value: levelRoles.length > 0
            ? levelRoles.map(r => `Level ${r.level}: <@&${r.roleId}>`).join('\n')
            : 'No level roles set.',
        },
        {
          name: 'Stackable Roles',
          value: guildData.stackable ? 'Enabled' : 'Disabled',
        }
      );

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('add_level_role')
          .setLabel('Add Level Role')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('remove_level_role')
          .setLabel('Remove Level Role')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('toggle_stackable')
          .setLabel('Toggle Stackable')
          .setStyle(ButtonStyle.Secondary)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('list_roles')
          .setLabel('Refresh List')
          .setStyle(ButtonStyle.Success)
      );

    const replyMessage = await interaction.editReply({
      embeds: [embed],
      components: [row1, row2],
    });

    const filter = (i) => i.user.id === interaction.user.id;

    const collector = replyMessage.createMessageComponentCollector({
      filter,
      time: 300000, // 5 minutes
    });

    collector.on('collect', async (i) => {
      await i.deferUpdate();

      if (i.customId === 'add_level_role') {
        // Prompt for level
        const levelPrompt = new EmbedBuilder()
          .setTitle('Add Level Role')
          .setDescription('Enter the level number (e.g., 5):')
          .setColor('Green');

        await i.editReply({
          embeds: [levelPrompt],
          components: [],
        });

        const levelCollector = interaction.channel.createMessageCollector({
          filter: (m) => m.author.id === interaction.user.id,
          time: 60000,
          max: 1,
        });

        levelCollector.on('collect', async (msg) => {
          const level = parseInt(msg.content);
          if (isNaN(level) || level < 1) {
            return msg.reply('Invalid level. Please enter a positive number.');
          }

          // Check if level already exists
          const existing = await LevelRoles.findOne({
            guildId: interaction.guild.id,
            level: level,
          });
          if (existing) {
            return msg.reply('A role is already assigned to this level.');
          }

          // Prompt for role
          const rolePrompt = new EmbedBuilder()
            .setTitle('Add Level Role')
            .setDescription(`Select the role for level ${level}:`)
            .setColor('Green');

          const roleSelect = new ActionRowBuilder()
            .addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('select_role')
                .setPlaceholder('Choose a role')
                .addOptions(
                  interaction.guild.roles.cache
                    .filter(r => r.name !== '@everyone' && !r.managed)
                    .first(25)
                    .map(r => ({
                      label: r.name,
                      value: r.id,
                    }))
                )
            );

          await msg.reply({
            embeds: [rolePrompt],
            components: [roleSelect],
          });

          const roleCollector = interaction.channel.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: (j) => j.user.id === interaction.user.id,
            time: 60000,
          });

          roleCollector.on('collect', async (j) => {
            const roleId = j.values[0];

            // Double-check for existing role before creating
            const existing = await LevelRoles.findOne({
              guildId: interaction.guild.id,
              level: level,
            });

            if (existing) {
              await j.reply({
                content: 'A role is already assigned to this level.',
                ephemeral: true,
              });
              return;
            }

            await LevelRoles.create({
              guildId: interaction.guild.id,
              level: level,
              roleId: roleId,
            });

            try {
              await j.update({
                content: `Role added for level ${level}.`,
                embeds: [],
                components: [],
              });
            } catch (error) {
              if (error.code === 40060) {
                // Interaction already acknowledged, send a follow-up
                await j.followUp({
                  content: `Role added for level ${level}.`,
                  ephemeral: true,
                });
              } else {
                throw error;
              }
            }

            // Refresh dashboard
            await refreshDashboard(i);
          });
        });
      } else if (i.customId === 'remove_level_role') {
        if (levelRoles.length === 0) {
          return i.editReply({
            content: 'No level roles to remove.',
            embeds: [],
            components: [],
          });
        }

        const removeSelect = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('remove_role_select')
              .setPlaceholder('Choose a level role to remove')
              .addOptions(
                levelRoles.map(r => ({
                  label: `Level ${r.level}`,
                  value: r.level.toString(),
                }))
              )
          );

        await i.editReply({
          content: 'Select the level role to remove:',
          embeds: [],
          components: [removeSelect],
        });

        const removeCollector = interaction.channel.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          filter: (j) => j.user.id === interaction.user.id,
          time: 60000,
        });

        removeCollector.on('collect', async (j) => {
          const level = parseInt(j.values[0]);
          await LevelRoles.deleteOne({
            guildId: interaction.guild.id,
            level: level,
          });

          try {
            await j.update({
              content: `Role for level ${level} removed.`,
              embeds: [],
              components: [],
            });
          } catch (error) {
            if (error.code === 40060) {
              // Interaction already acknowledged, send a follow-up
              await j.followUp({
                content: `Role for level ${level} removed.`,
                ephemeral: true,
              });
            } else {
              throw error;
            }
          }

          // Refresh dashboard
          await refreshDashboard(i);
        });
      } else if (i.customId === 'toggle_stackable') {
        const newStackable = !guildData.stackable;
        await GuildSettings.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { stackable: newStackable },
          { upsert: true }
        );

        await i.editReply({
          content: `Stackable roles ${newStackable ? 'enabled' : 'disabled'}.`,
          embeds: [],
          components: [],
        });

        // Refresh dashboard
        await refreshDashboard(i);
      } else if (i.customId === 'list_roles') {
        await refreshDashboard(i);
      }
    });

    collector.on('end', () => {
      interaction.editReply({
        content: 'Dashboard timed out.',
        embeds: [],
        components: [],
      });
    });

    async function refreshDashboard(interaction) {
      const updatedRoles = await LevelRoles.find({
        guildId: interaction.guild.id,
      }).sort({ level: 1 });

      const updatedGuildData = await GuildSettings.findOne({
        guildId: interaction.guild.id,
      });

      const updatedEmbed = new EmbedBuilder()
        .setTitle('Level Role Setup Dashboard')
        .setDescription('Manage roles assigned at specific levels.')
        .setColor('Blue')
        .addFields(
          {
            name: 'Current Level Roles',
            value: updatedRoles.length > 0
              ? updatedRoles.map(r => `Level ${r.level}: <@&${r.roleId}>`).join('\n')
              : 'No level roles set.',
          },
          {
            name: 'Stackable Roles',
            value: updatedGuildData.stackable ? 'Enabled' : 'Disabled',
          }
        );

      await interaction.editReply({
        content: '',
        embeds: [updatedEmbed],
        components: [row1, row2],
      });
    }
  },
};
