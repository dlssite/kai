const {
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
} = require('discord.js');
const { GuildSettings, LevelRoles, MemberData, BonusXpRoles } = require('../../models/Level');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('leveladmin')
    .setDescription('Manage the level system')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('addlevelrole')
        .setDescription('Add a role to be given at a specific level')
        .addIntegerOption((option) =>
          option
            .setName('level')
            .setDescription('Level to assign the role at')
            .setRequired(true)
        )
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('Role to assign')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('removelevelrole')
        .setDescription('Remove a role assigned at a specific level')
        .addIntegerOption((option) =>
          option
            .setName('level')
            .setDescription('Level to remove the role from')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('addlevel')
        .setDescription('Add a level to a user')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('User to add a level to')
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('level')
            .setDescription('Level to add')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setlevel')
        .setDescription("Set a user's level")
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('User to set the level for')
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('level')
            .setDescription('Level to set')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('removelevel')
        .setDescription('Remove a level from a user')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('User to remove a level from')
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('level')
            .setDescription('Level to remove')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setlevelupchannel')
        .setDescription('Set the channel for level-up announcements')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The channel to send announcements')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setxprate')
        .setDescription('Set the XP growth rate')
        .addNumberOption((option) =>
          option
            .setName('rate')
            .setDescription('The XP rate multiplier')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle')
        .setDescription('Turn the level system on or off')
        .addStringOption((option) =>
          option
            .setName('state')
            .setDescription('Turn the leveling system on or off')
            .addChoices(
              { name: 'on', value: 'on' },
              { name: 'off', value: 'off' }
            )
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('listlevelroles')
        .setDescription('List all level roles for this guild')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('togglestackable')
        .setDescription('Toggle stackable roles on or off')
        .addStringOption((option) =>
          option
            .setName('state')
            .setDescription('Turn stackable roles on or off')
            .addChoices(
              { name: 'on', value: 'on' },
              { name: 'off', value: 'off' }
            )
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('resetlevels')
        .setDescription('Reset all user levels to 1 and XP to 0 (irreversible)')
        .addStringOption((option) =>
          option
            .setName('confirm')
            .setDescription('Type "CONFIRM" to proceed with resetting all levels')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('addbonusxprole')
        .setDescription('Add a role that gives bonus XP multiplier')
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('Role to give bonus XP')
            .setRequired(true)
        )
        .addNumberOption((option) =>
          option
            .setName('multiplier')
            .setDescription('XP multiplier (e.g., 1.5 for 50% bonus)')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('removebonusxprole')
        .setDescription('Remove bonus XP from a role')
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('Role to remove bonus XP from')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('listbonusxproles')
        .setDescription('List all roles with bonus XP multipliers')
    ),
  async execute(interaction) {
    const guildData = await GuildSettings.findOne({
      guildId: interaction.guild.id,
    });
    const subcommand = interaction.options.getSubcommand();
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        content: 'You do not have `Administrator` permission to manage levels!',
        ephemeral: true,
      });
    }

    switch (subcommand) {
      case 'addlevelrole': {
        if (!guildData.levelingEnabled) {
          return interaction.reply({
            content: 'Leveling system is not enabled in this Server',
          });
        }

        const level = interaction.options.getInteger('level');
        const role = interaction.options.getRole('role');

        await LevelRoles.create({
          guildId: interaction.guild.id,
          level: level,
          roleId: role.id,
        });

        const embed = new EmbedBuilder()
          .setTitle('Level Role Added')
          .setDescription(
            `Role **${role.name}** will be given at level **${level}**.`
          )
          .setColor('Green');

        await interaction.reply({ embeds: [embed] });
        break;
      }
      case 'removelevelrole': {
        if (!guildData.levelingEnabled) {
          return interaction.reply({
            content: 'Leveling system is not enabled in this Server',
          });
        }
        const level = interaction.options.getInteger('level');
        await LevelRoles.deleteOne({
          guildId: interaction.guild.id,
          level: level,
        });

        const embed = new EmbedBuilder()
          .setTitle('Level Role Removed')
          .setDescription(`Role for level **${level}** has been removed.`)
          .setColor('Red');

        await interaction.reply({ embeds: [embed] });
        break;
      }
      case 'addlevel': {
        if (!guildData.levelingEnabled) {
          return interaction.reply({
            content: 'Leveling system is not enabled in this Server',
          });
        }
        const user = interaction.options.getUser('user');
        const levelToAdd = interaction.options.getInteger('level');
        let memberData = await MemberData.findOne({
          guildId: interaction.guild.id,
          userId: user.id,
        });

        if (!memberData) {
          memberData = new MemberData({
            guildId: interaction.guild.id,
            userId: user.id,
            level: 1,
            xp: 0,
          });
        }
        memberData.level += levelToAdd;
        await memberData.save();

        const embed = new EmbedBuilder()
          .setTitle('Level Added')
          .setDescription(
            `${user.username} has been given **${levelToAdd}** level(s).`
          )
          .setColor('Blue');

        await interaction.reply({ embeds: [embed] });
        break;
      }
      case 'setlevel': {
        if (!guildData.levelingEnabled) {
          return interaction.reply({
            content: 'Leveling system is not enabled in this Server',
          });
        }
        const user = interaction.options.getUser('user');
        const newLevel = interaction.options.getInteger('level');
        let memberData = await MemberData.findOne({
          guildId: interaction.guild.id,
          userId: user.id,
        });

        if (!memberData) {
          memberData = new MemberData({
            guildId: interaction.guild.id,
            userId: user.id,
            level: newLevel,
            xp: 0,
          });
        } else {
          memberData.level = newLevel;
        }
        await memberData.save();

        const embed = new EmbedBuilder()
          .setTitle('Level Set')
          .setDescription(
            `${user.username}'s level has been set to **${newLevel}**.`
          )
          .setColor('Yellow');

        await interaction.reply({ embeds: [embed] });
        break;
      }
      case 'removelevel': {
        if (!guildData.levelingEnabled) {
          return interaction.reply({
            content: 'Leveling system is not enabled in this Server',
          });
        }
        const user = interaction.options.getUser('user');
        const levelToRemove = interaction.options.getInteger('level');
        let memberData = await MemberData.findOne({
          guildId: interaction.guild.id,
          userId: user.id,
        });

        if (!memberData || memberData.level <= 1) {
          return interaction.reply({
            content: `${user.username} does not have enough levels to remove.`,
            ephemeral: true,
          });
        }
        memberData.level = Math.max(1, memberData.level - levelToRemove);
        await memberData.save();

        const embed = new EmbedBuilder()
          .setTitle('Level Removed')
          .setDescription(
            `${levelToRemove} level(s) have been removed from ${user.username}.`
          )
          .setColor('Orange');

        await interaction.reply({ embeds: [embed] });
        break;
      }
      case 'setlevelupchannel': {
        if (!guildData.levelingEnabled) {
          return interaction.reply({
            content: 'Leveling system is not enabled in this Server',
          });
        }
        const channel = interaction.options.getChannel('channel');
        await GuildSettings.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { levelUpChannelId: channel.id },
          { upsert: true }
        );

        const embed = new EmbedBuilder()
          .setTitle('Level-Up Channel Set')
          .setDescription(`Level-up announcements will be sent to ${channel}.`)
          .setColor('Purple');

        await interaction.reply({ embeds: [embed] });
        break;
      }
      case 'setxprate': {
        if (!guildData.levelingEnabled) {
          return interaction.reply({
            content: 'Leveling system is not enabled in this Server',
          });
        }
        const rate = interaction.options.getNumber('rate');
        await GuildSettings.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { xpRate: rate },
          { upsert: true }
        );

        const embed = new EmbedBuilder()
          .setTitle('XP Rate Set')
          .setDescription(`XP rate has been set to **${rate}**.`)
          .setColor('Aqua');

        await interaction.reply({ embeds: [embed] });
        break;
      }
      case 'toggle': {
        const state = interaction.options.getString('state');
        const isEnabled = state === 'on';
        await GuildSettings.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { levelingEnabled: isEnabled },
          { upsert: true }
        );

        const embed = new EmbedBuilder()
          .setTitle('Leveling System Toggled')
          .setDescription(`Leveling system has been turned **${state}**.`)
          .setColor(isEnabled ? 'Green' : 'Red');

        await interaction.reply({ embeds: [embed] });
        break;
      }
      case 'listlevelroles': {
        if (!guildData.levelingEnabled) {
          return interaction.reply({
            content: 'Leveling system is not enabled in this Server',
          });
        }
        if (!interaction.guild) {
          return interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
          });
        }

        const levelRoles = await LevelRoles.find({
          guildId: interaction.guild.id,
        });

        if (levelRoles.length === 0) {
          return interaction.reply({
            content: 'No level roles found for this guild.',
            ephemeral: true,
          });
        }

        const rolesList = levelRoles
          .map((role) => `Level ${role.level}: <@&${role.roleId}>`)
          .join('\n');

        await interaction.reply({
          content: `**Level Roles for this guild:**\n${rolesList}`,
          ephemeral: true,
        });
        break;
      }
      case 'togglestackable': {
        const state = interaction.options.getString('state');
        const isStackable = state === 'on';
        await GuildSettings.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { stackable: isStackable },
          { upsert: true }
        );

        const embed = new EmbedBuilder()
          .setTitle('Stackable Roles Toggled')
          .setDescription(`Stackable roles have been turned **${state}**.`)
          .setColor(isStackable ? 'Green' : 'Red');

        await interaction.reply({ embeds: [embed] });
        break;
      }
      case 'resetlevels': {
        const confirmText = interaction.options.getString('confirm');

        if (confirmText !== 'CONFIRM') {
          return interaction.reply({
            content: 'You must type "CONFIRM" exactly to reset all levels. This action cannot be undone.',
            ephemeral: true,
          });
        }

        // Count users before reset
        const userCount = await MemberData.countDocuments({
          guildId: interaction.guild.id,
        });

        // Reset all member data for this guild
        await MemberData.updateMany(
          { guildId: interaction.guild.id },
          {
            level: 1,
            xp: 0,
            totalXp: 0,
          }
        );

        // Remove all level roles from members
        const levelRoles = await LevelRoles.find({
          guildId: interaction.guild.id,
        });

        if (levelRoles.length > 0) {
          const members = await interaction.guild.members.fetch();
          const roleIds = levelRoles.map(r => r.roleId);

          for (const member of members.values()) {
            if (!member.user.bot) {
              const rolesToRemove = member.roles.cache.filter(role =>
                roleIds.includes(role.id)
              );

              if (rolesToRemove.size > 0) {
                try {
                  await member.roles.remove(rolesToRemove);
                } catch (error) {
                  console.error(`Failed to remove roles from ${member.user.tag}:`, error.message);
                }
              }
            }
          }
        }

        const embed = new EmbedBuilder()
          .setTitle('Levels Reset')
          .setDescription(`All user levels have been reset to 1 and XP set to 0 for **${userCount}** users.\n\n**Note:** Level roles have been removed from all members.`)
          .setColor('Red');

        await interaction.reply({ embeds: [embed] });
        break;
      }
      case 'addbonusxprole': {
        if (!guildData.levelingEnabled) {
          return interaction.reply({
            content: 'Leveling system is not enabled in this Server',
          });
        }

        const role = interaction.options.getRole('role');
        const multiplier = interaction.options.getNumber('multiplier');

        if (multiplier < 1) {
          return interaction.reply({
            content: 'Multiplier must be at least 1.0 (no bonus) or higher.',
            ephemeral: true,
          });
        }

        await BonusXpRoles.create({
          guildId: interaction.guild.id,
          roleId: role.id,
          multiplier: multiplier,
        });

        const embed = new EmbedBuilder()
          .setTitle('Bonus XP Role Added')
          .setDescription(`Role **${role.name}** now gives **${multiplier}x** XP multiplier.`)
          .setColor('Green');

        await interaction.reply({ embeds: [embed] });
        break;
      }
      case 'removebonusxprole': {
        if (!guildData.levelingEnabled) {
          return interaction.reply({
            content: 'Leveling system is not enabled in this Server',
          });
        }

        const role = interaction.options.getRole('role');

        await BonusXpRoles.deleteOne({
          guildId: interaction.guild.id,
          roleId: role.id,
        });

        const embed = new EmbedBuilder()
          .setTitle('Bonus XP Role Removed')
          .setDescription(`Bonus XP has been removed from role **${role.name}**.`)
          .setColor('Red');

        await interaction.reply({ embeds: [embed] });
        break;
      }
      case 'listbonusxproles': {
        if (!guildData.levelingEnabled) {
          return interaction.reply({
            content: 'Leveling system is not enabled in this Server',
          });
        }

        if (!interaction.guild) {
          return interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
          });
        }

        const bonusXpRoles = await BonusXpRoles.find({
          guildId: interaction.guild.id,
        });

        if (bonusXpRoles.length === 0) {
          return interaction.reply({
            content: 'No bonus XP roles found for this guild.',
            ephemeral: true,
          });
        }

        const rolesList = bonusXpRoles
          .map((role) => `<@&${role.roleId}>: ${role.multiplier}x XP`)
          .join('\n');

        await interaction.reply({
          content: `**Bonus XP Roles for this guild:**\n${rolesList}`,
          ephemeral: true,
        });
        break;
      }
    }
  },
};
