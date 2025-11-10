const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  AttachmentBuilder,
} = require('discord.js');
const RealmWar = require('../../models/WorldWar');
const path = require('path');
const Canvas = require('canvas');
const sharp = require('sharp');
const fetch = require('node-fetch');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('realmwar')
    .setDescription('Manage the RealmWar (Dark Fantasy) game')
    .addSubcommand((subcommand) =>
      subcommand
  .setName('setup')
  .setDescription('Prepare the RealmWar: gather your champions for a battle in the cursed lands')
        .addIntegerOption((option) =>
          option
            .setName('min_participants')
            .setDescription('Minimum participants')
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('max_participants')
            .setDescription('Maximum participants')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
  subcommand.setName('start').setDescription('Begin the RealmWar: unleash the darkness.')
    )
    .addSubcommand((subcommand) =>
      subcommand
  .setName('cancel')
  .setDescription('Cancel the active RealmWar (dark fantasy) game.')
    )
    .addSubcommand((subcommand) =>
      subcommand
  .setName('stop')
  .setDescription('End the RealmWar before the last soul falls.')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setup') {
      await setupGame(interaction);
    } else if (subcommand === 'start') {
      await startGame(interaction);
    } else if (subcommand === 'cancel') {
      await cancelGame(interaction);
    } else if (subcommand === 'stop') {
      await stopGame(interaction);
    }
  },
};

async function setupGame(interaction) {
  await interaction.deferReply();

  if (!interaction.member.permissions.has('ManageServer')) {
    return interaction.editReply({
      content:
        'You do not have `ManageServer` permission to manage RealmWar (dark fantasy) game',
    });
  }
  const min = interaction.options.getInteger('min_participants');
  const max = interaction.options.getInteger('max_participants');

  if (min < 2)
    return interaction.editReply('Minimum participants must be at least 2.');
  if (max <= min)
    return interaction.editReply(
      'Maximum participants must be greater than minimum participants.'
    );

  let warNumber;
  try {
    const count = await RealmWar.countDocuments();
    warNumber = count + 1;
  } catch (error) {
    console.error('Error counting documents:', error);
    warNumber = 1;
  }

  const newGame = new RealmWar({
    warNumber,
    minParticipants: min,
    maxParticipants: max,
    participants: [],
    status: 'active',
  });

  try {
    await newGame.save();
  } catch (error) {
    console.error('Error saving game to database:', error);
    return interaction.editReply(
      'Failed to create the game. Please try again later.'
    );
  }

  const joinButton = new ButtonBuilder()
    .setCustomId(`realmwar-join-${warNumber}`)
    .setLabel('Join the RealmWar!')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(joinButton);

  const embed = new EmbedBuilder()
    .setTitle(`🕯️ RealmWar #${warNumber}`)
    .setDescription(
      `> The cursed lands awaken. Champions and fiends gather for a night of blood and shadow.\n\n` +
        `🩸 **Dark Ritual Requirements**\n` +
        `• Minimum Champions: ${min}\n` +
        `• Maximum Champions: ${max}\n` +
        `• Current Champions: 0\n\n` +
        `🕯️ **Join the Ritual!**\n` +
        `Click below to enter the haunted battlefield!`
    )
    .setColor('#2B1B2F')
    .setTimestamp();

  const message = await interaction.editReply({ embeds: [embed], components: [row] });
  newGame.messageId = message.id;
  await newGame.save();
}

async function startGame(interaction) {
  const activeGame = await RealmWar.findOne({ status: 'active' });
  if (!activeGame)
    return interaction.reply(
      'No active RealmWar found. Use `/realmwar setup` first.'
    );

  if (activeGame.participants.length < activeGame.minParticipants) {
    return interaction.reply(
      `Not enough champions to begin the ritual. At least ${activeGame.minParticipants} are required.`
    );
  }

  interaction.reply(`RealmWar #${activeGame.warNumber} begins! The darkness stirs...`);
  await runGame(interaction.channel, activeGame, interaction);
}

async function cancelGame(interaction) {
  const activeGame = await RealmWar.findOne({ status: 'active' });
  if (!activeGame)
    return interaction.reply('No active RealmWar to cancel.');

  activeGame.status = 'canceled';
  await activeGame.save();

  interaction.reply(`RealmWar #${activeGame.warNumber} has been canceled. The shadows recede.`);
}

async function stopGame(interaction) {
  const activeGame = await RealmWar.findOne({ status: 'active' });
  if (!activeGame) return interaction.reply('No active RealmWar to stop.');

  activeGame.status = 'completed';
  activeGame.endedAt = Date.now();
  await activeGame.save();

  interaction.reply(
    `RealmWar #${activeGame.warNumber} has ended before the last soul fell.`
  );
}

async function runGame(channel, game, interaction) {
  let participants = game.participants;
  let kills = {};
  let joinTimes = {};

  participants.forEach((participant) => {
    kills[participant] = 0;
    joinTimes[participant] = Date.now();
  });

  while (participants.length > 1) {
    const killer =
      participants[Math.floor(Math.random() * participants.length)];
    const victim =
      participants[Math.floor(Math.random() * participants.length)];
    if (killer === victim) continue;

    kills[killer]++;

    participants = participants.filter((id) => id !== victim);
    game.eliminated.push(victim);
    await game.save();

    await announceElimination(
      channel,
      killer,
      victim,
      participants.length,
      interaction.guild
    );

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const winner = participants[0];
  game.winner = winner;
  game.status = 'completed';
  game.endedAt = Date.now();
  await game.save();
  const survivorTime = ((Date.now() - joinTimes[winner]) / 1000 / 60).toFixed(
    2
  );
  displayWinner(
    channel,
    winner,
    game.warNumber,
    interaction.guild,
    kills,
    survivorTime
  );
}

async function announceElimination(channel, killer, victim, remaining, guild) {
  const canvas = Canvas.createCanvas(1200, 600);
  const ctx = canvas.getContext('2d');

  const background = await Canvas.loadImage(
    path.join(__dirname, '../../utils/worldwar-background.png')
  );
  ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

  const killerUser = guild.members.cache.get(killer);
  const killerAv = killerUser.displayAvatarURL({
    format: 'webp',
    size: 256,
  });
  const killerResponse = await fetch(killerAv);
  const killerBuffer = await killerResponse.buffer();
  const killerPngBuffer = await sharp(killerBuffer).png().toBuffer();

  const victimUser = guild.members.cache.get(victim);
  const victimAv = victimUser.displayAvatarURL({
    format: 'png',
    size: 256,
  });
  const victimResponse = await fetch(victimAv);
  const victimBuffer = await victimResponse.buffer();
  const victimPngBuffer = await sharp(victimBuffer).png().toBuffer();

  const killerAvatar = await Canvas.loadImage(killerPngBuffer);
  const victimAvatar = await Canvas.loadImage(victimPngBuffer);

  const verticalCenter = (canvas.height - 400) / 2;

  ctx.drawImage(killerAvatar, 100, verticalCenter, 400, 400);

  ctx.drawImage(victimAvatar, 700, verticalCenter, 400, 400);
  const victimImageData = ctx.getImageData(700, verticalCenter, 400, 400);
  const data = victimImageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = data[i + 1] = data[i + 2] = avg;
  }

  ctx.putImageData(victimImageData, 700, verticalCenter);

  const sword = await Canvas.loadImage(
    path.join(__dirname, '../../utils/sword.png')
  );

  const swordWidth = 400;
  const swordHeight = 400;
  const swordX = (canvas.width - swordWidth) / 2;
  const swordY = (canvas.height - swordHeight) / 2;
  ctx.drawImage(sword, swordX, swordY, swordWidth, swordHeight);

  const eliminationMessages = [
    `🩸 The shadows claim <@${victim}> as <@${killer}> delivers a cursed blow!`,
    `☠️ <@${killer}>'s dark magic consumes <@${victim}>!`,
    `🌑 <@${victim}> is lost to the abyss by <@${killer}>'s hand!`,
    `�️ <@${killer}> whispers a forbidden spell, ending <@${victim}>'s journey!`,
    `🦇 <@${killer}> unleashes a swarm of night creatures upon <@${victim}>!`,
    `💀 <@${victim}> is devoured by the darkness summoned by <@${killer}>!`,
    `🌪️ <@${killer}>'s shadow storm obliterates <@${victim}>!`,
    `🗡️ <@${victim}> falls to <@${killer}>'s cursed blade!`,
    `🔥 <@${killer}> incinerates <@${victim}> with hellfire!`,
    `🌘 <@${victim}> fades into oblivion as <@${killer}> stands victorious!`,
    `🕸️ <@${killer}> traps <@${victim}> in a web of nightmares!`,
    `🩸 <@${killer}> drinks the soul of <@${victim}>!`,
    `🌑 <@${killer}> banishes <@${victim}> to the realm of lost souls!`,
    `🦇 <@${killer}> calls forth the night to consume <@${victim}>!`,
    `💀 <@${victim}>'s last breath is stolen by <@${killer}>'s curse!`,
    `🕯️ <@${killer}> extinguishes <@${victim}>'s hope!`,
    `🩸 <@${killer}> marks <@${victim}> for eternal darkness!`,
    `🌑 <@${killer}> shrouds <@${victim}> in endless night!`,
    `🦇 <@${killer}> feasts on <@${victim}>'s fear!`,
    `💀 <@${victim}> is erased from the mortal realm by <@${killer}>!`,
    `🌪️ <@${killer}>'s dark wind sweeps away <@${victim}>!`,
    `🗡️ <@${victim}> succumbs to <@${killer}>'s shadow strike!`,
    `🔥 <@${killer}> scorches <@${victim}>'s soul!`,
    `🌘 <@${victim}> is forgotten in the void by <@${killer}>!`,
  ];

  const eliminationMessage =
    eliminationMessages[Math.floor(Math.random() * eliminationMessages.length)];

  const attachment = new AttachmentBuilder(canvas.toBuffer(), {
    name: 'elimination.png',
  });

  const embed = new EmbedBuilder()
    .setTitle('🕯️ Ritual Report')
    .setDescription(eliminationMessage)
    .setImage('attachment://elimination.png')
    .setColor('#2B1B2F')
    .addFields(
      { name: '🩸 Victor', value: `<@${killer}>`, inline: true },
      { name: '💀 Banished', value: `<@${victim}>`, inline: true },
      {
        name: '� Remaining Champions',
        value: `${remaining} souls remain`,
        inline: false,
      }
    )
    .setTimestamp();

  await channel.send({ embeds: [embed], files: [attachment] });
}

async function displayWinner(
  channel,
  winner,
  warNumber,
  guild,
  kills,
  survivorTime
) {
  const canvas = Canvas.createCanvas(600, 600);
  const ctx = canvas.getContext('2d');

  const background = await Canvas.loadImage(
    path.join(__dirname, '../../utils/worldwar-background.png')
  );
  ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

  const winnerUser = guild.members.cache.get(winner);
  const winnerAv = winnerUser.displayAvatarURL({
    format: 'webp',
    size: 256,
  });
  const winnerResponse = await fetch(winnerAv);
  const winnerBuffer = await winnerResponse.buffer();
  const winnerPngBuffer = await sharp(winnerBuffer).png().toBuffer();

  const winnerAvatar = await Canvas.loadImage(winnerPngBuffer);

  const crown = await Canvas.loadImage(
    path.join(__dirname, '../../utils/crown.png')
  );

  const avatarX = (canvas.width - 256) / 2;
  const avatarY = (canvas.height - 256) / 2;
  ctx.drawImage(winnerAvatar, avatarX, avatarY, 256, 256);

  const crownWidth = 200;
  const crownHeight = 200;
  const crownX = (canvas.width - crownWidth) / 2;
  const crownY = avatarY - crownHeight / 2;
  ctx.drawImage(crown, crownX, crownY, crownWidth, crownHeight);

  const attachment = new AttachmentBuilder(canvas.toBuffer(), {
    name: 'winner.png',
  });

  const embed = new EmbedBuilder()
    .setTitle(`🩸 Champion of RealmWar #${warNumber}`)
    .setDescription(
      `> The ritual ends... One soul stands above the rest, crowned in darkness!\n\n` +
        `🩸 **CHAMPION: <@${winner}>**`
    )
    .setImage('attachment://winner.png')
    .setColor('#2B1B2F')
    .addFields(
      {
        name: '🕯️ Champion Stats',
        value: `Banished: ${kills[winner]}\nSurvival Time: ${survivorTime} minutes`,
        inline: true,
      },
      { name: '� Achievement', value: 'RealmWar Champion', inline: true }
    )
    .setTimestamp();

  await channel.send({ embeds: [embed], files: [attachment] });

  // --- Assign winner role ---
  try {
    const ServerRealmWarConfig = require('../../models/ServerRealmWarConfig');
    const config = await ServerRealmWarConfig.findOne({ guildId: guild.id });
    if (config && config.winnerRoleId) {
      const winnerRole = guild.roles.cache.get(config.winnerRoleId);
      if (winnerRole) {
        // Remove role from all members who have it
        for (const member of guild.members.cache.values()) {
          if (member.roles.cache.has(winnerRole.id) && member.id !== winner) {
            await member.roles.remove(winnerRole).catch(() => {});
          }
        }
        // Add role to winner
        const winnerMember = guild.members.cache.get(winner);
        if (winnerMember) {
          await winnerMember.roles.add(winnerRole).catch(() => {});
        }
      }
    }
  } catch (e) {
    console.error('Error assigning RealmWar winner role:', e);
  }
}
