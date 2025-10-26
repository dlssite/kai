const { Events } = require('discord.js');
const { GuildSettings, MemberData, LevelRoles, BonusXpRoles } = require('../models/Level');
const { ActivityData } = require('../models/Activity');

const cooldowns = new Map();
const messageTimestamps = new Map();

module.exports = {
  name: Events.MessageCreate,

  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const guildData = await GuildSettings.findOne({
      guildId: message.guild.id,
    });
    if (!guildData || !guildData.levelingEnabled) return;

    const messageCooldown = 3000;
    const xpRate = guildData.xpRate || 1;
    const currentTime = Date.now();
    const lastMessageTime = messageTimestamps.get(message.author.id);

    if (lastMessageTime && currentTime - lastMessageTime < messageCooldown)
      return;
    messageTimestamps.set(message.author.id, currentTime);

    // Calculate bonus XP multiplier based on user's roles
    let bonusMultiplier = 1;
    try {
      const member = await message.guild.members.fetch(message.author.id);
      const bonusXpRoles = await BonusXpRoles.find({
        guildId: message.guild.id,
      });

      for (const bonusRole of bonusXpRoles) {
        if (member.roles.cache.has(bonusRole.roleId)) {
          bonusMultiplier = Math.max(bonusMultiplier, bonusRole.multiplier);
        }
      }
    } catch (error) {
      console.error('Error calculating bonus XP:', error.message);
    }

    const baseXp = Math.floor(Math.random() * 10 + 5);
    const xpToAdd = Math.floor(baseXp * xpRate * bonusMultiplier);

    let memberData = await MemberData.findOne({
      guildId: message.guild.id,
      userId: message.author.id,
    });

    if (!memberData) {
      memberData = new MemberData({
        guildId: message.guild.id,
        userId: message.author.id,
        level: 1,
        xp: 0,
        totalXp: 0,
      });
    }

    memberData.xp += xpToAdd;
    memberData.totalXp += xpToAdd;

    // Update activity data
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    let activityData = await ActivityData.findOne({
      guildId: message.guild.id,
      userId: message.author.id,
      date: { $gte: today },
    });

    if (!activityData) {
      activityData = new ActivityData({
        guildId: message.guild.id,
        userId: message.author.id,
        date: today,
        dailyCount: 0,
        weeklyCount: 0,
        monthlyCount: 0,
        streak: 0,
        lastActive: new Date(),
      });
    }

    // Check for streak
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const lastActivity = await ActivityData.findOne({
      guildId: message.guild.id,
      userId: message.author.id,
      date: { $gte: yesterday, $lt: today },
    });

    if (lastActivity && lastActivity.lastActive.toDateString() === yesterday.toDateString()) {
      activityData.streak = lastActivity.streak + 1;
      if (activityData.streak > activityData.highestStreak) {
        activityData.highestStreak = activityData.streak;
      }
    } else if (!lastActivity || lastActivity.lastActive.toDateString() !== today.toDateString()) {
      activityData.streak = 1;
      if (activityData.streak > activityData.highestStreak) {
        activityData.highestStreak = activityData.streak;
      }
    }

    activityData.dailyCount += 1;
    activityData.weeklyCount += 1;
    activityData.monthlyCount += 1;
    activityData.lastActive = new Date();

    // Track additional activities from the message
    if (message.attachments.size > 0) {
      activityData.attachmentsSent += message.attachments.size;
    }

    // Count mentions given
    const mentionRegex = /<@!?(\d+)>/g;
    const mentions = message.content.match(mentionRegex);
    if (mentions) {
      activityData.mentionsGiven += mentions.length;
    }

    await activityData.save();

    const calculateXpNeeded = (level) => {
      if (level === 1) return guildData.startingXp || 100;
      return (
        (guildData.startingXp || 100) +
        (level - 1) * (guildData.xpPerLevel || 50)
      );
    };

    let previousLevel = memberData.level;
    let levelUpCount = 0;

    while (memberData.xp >= calculateXpNeeded(memberData.level)) {
      memberData.xp -= calculateXpNeeded(memberData.level);
      memberData.level++;
      levelUpCount++;
    }

    if (levelUpCount > 0) {
      const cooldownTime = 5000;
      const userId = message.author.id;

      if (
        !cooldowns.has(userId) ||
        currentTime - cooldowns.get(userId) > cooldownTime
      ) {
        cooldowns.set(userId, currentTime);
        await module.exports.notifyLevelUp(
          message,
          memberData.level,
          guildData
        );
      }

      await module.exports.assignRoles(
        message,
        previousLevel + 1,
        memberData.level
      );
    }

    await memberData.save();
  },

  notifyLevelUp: async (message, level, guildData) => {
    try {
      let channel = message.channel;

      if (guildData.levelUpChannelId) {
        const target = message.guild.channels.cache.get(
          guildData.levelUpChannelId
        );
        if (target && target.isTextBased()) channel = target;
      }

      if (!channel || !channel.send) {
        console.warn(
          `No valid level-up channel found for guild ${message.guild.id}`
        );
        return;
      }

      const { LevelRoles } = require('../models/Level');
      const earnedRoles = await LevelRoles.find({
        guildId: message.guild.id,
        level: level,
      });

      let roleMention = '';
      if (earnedRoles.length > 0) {
        roleMention = ` You earned the role(s): ${earnedRoles.map(r => `<@&${r.roleId}>`).join(', ')}`;
      }

      await channel.send(
        `${message.author} has leveled up to level **${level}**! 🎉${roleMention}`
      );
    } catch (err) {
      console.error('Level-up message failed:', err.message);
    }
  },

  assignRoles: async (message, startLevel, endLevel) => {
    try {
      const member = await message.guild.members.fetch(message.author.id);
      const guildData = await GuildSettings.findOne({
        guildId: message.guild.id,
      });

      const rolesToAdd = await LevelRoles.find({
        guildId: message.guild.id,
        level: { $gte: startLevel, $lte: endLevel },
      });

      const additionalRoles = await LevelRoles.find({
        guildId: message.guild.id,
        level: { $lt: startLevel },
      });

      const allRoles = [...rolesToAdd, ...additionalRoles];

      if (guildData.stackable) {
        // Remove roles from levels below the new level
        const lowerRoles = await LevelRoles.find({
          guildId: message.guild.id,
          level: { $lt: endLevel },
        });

        const roleChunksRemove = [];
        for (let i = 0; i < lowerRoles.length; i += 20) {
          roleChunksRemove.push(lowerRoles.slice(i, i + 20));
        }

        for (const chunk of roleChunksRemove) {
          const promises = chunk.map(async (roleData) => {
            const role = message.guild.roles.cache.get(roleData.roleId);
            if (role && member.roles.cache.has(role.id)) {
              try {
                await member.roles.remove(role);
              } catch (err) {
                console.error(
                  `Error removing role ${role.name} from ${member.user.tag}:`,
                  err.message
                );
              }
            }
          });
          await Promise.all(promises);
        }
      }

      const roleChunks = [];
      for (let i = 0; i < allRoles.length; i += 20) {
        roleChunks.push(allRoles.slice(i, i + 20)); // split into chunks of 20
      }

      for (const chunk of roleChunks) {
        const promises = chunk.map(async (roleData) => {
          const role = message.guild.roles.cache.get(roleData.roleId);
          if (role) {
            try {
              await member.roles.add(role);
            } catch (err) {
              console.error(
                `Error adding role ${role.name} to ${member.user.tag}:`,
                err.message
              );
            }
          }
        });

        await Promise.all(promises);
      }
    } catch (err) {
      console.error('Error assigning roles:', err.message);
    }
  },
};
