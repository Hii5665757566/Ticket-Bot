require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ROLE IDs
const ROLES = {
  STAFF_TEAM: "1487127237898666070",
  HIGH_RANK: "1487127238058180810",
  FOUNDERSHIP_TEAM: "1487127238141935635",
  MODERATION_TEAM: "1500199967841849478",
  ADMINISTRATION_TEAM: "1500198951117258802",
  INTERNAL_AFFAIRS: "1487127238028824690",
  SENIOR_INTERNAL_AFFAIRS: "1491314574194905159",
  MANAGEMENT_TEAM: "1487127238058180813",
  SENIOR_MANAGEMENT: "1487127238058180815",
  COMMUNITY_MANAGER: "1502148103862489148",
  SENIOR_MODERATOR: "1487127237953323105",
  SENIOR_ADMINISTRATOR: "1487127238003396641",
};

// CATEGORY IDs
const CATEGORY_GENERAL = "1501036273916444853";
const CATEGORY_HIGHRANK = "1501037177918853220";
const CATEGORY_FOUNDERSHIP = "1487165830826561737";

// CHANNEL IDs
const PANEL_CHANNEL = "1487127239945621611";
const LOG_CHANNEL = "1491261558880211004";

// COLORS
const COLOR_MAIN = 0x2b2d31;
const COLOR_LOG = 0x3498db;

// READY + PANEL (no emojis, no duplicates)
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(PANEL_CHANNEL).catch(() => null);
  if (!channel) return console.log("Panel channel not found.");

  const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  if (messages) {
    const alreadySent = messages.find(m => m.author.id === client.user.id);
    if (alreadySent) {
      console.log("Panel already exists — not sending again.");
      return;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle("🌴 Florida State Roleplay | Support Center")
    .setDescription(
      "**Welcome to the Official Florida State Roleplay Support Desk.**\n\n" +
        "Please select a ticket type below and our team will assist you shortly.\n\n" +
        "**General Support** — Basic questions, help, issues\n" +
        "**High Rank Support** — Appeals, staff reports, IA matters\n" +
        "**Foundership Support** — Foundership Only\n\n" +
        "Choose a category from the menu below to begin."
    )
    .setColor(COLOR_MAIN)
    .setFooter({ text: "Florida State Roleplay • Support System" })
    .setTimestamp();

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket-select")
    .setPlaceholder("Select a ticket type")
    .addOptions(
      {
        label: "General Support",
        value: "general_support",
        description: "For regular support, questions, and general issues.",
      },
      {
        label: "High Rank Support",
        value: "high_rank_support",
        description: "Appeals, staff reports, and HR-level issues.",
      },
      {
        label: "Foundership Support",
        value: "foundership_support",
        description: "Foundership Only.",
      }
    );

  const row = new ActionRowBuilder().addComponents(menu);
  await channel.send({ embeds: [embed], components: [row] });

  console.log("Support panel sent (no emojis, no duplicates).");
});

// WELCOME SYSTEM
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get("1487127240515911798");
  if (!channel) return;

  channel.send({
    content: `👋 Welcome <@${member.id}> to **Florida State Roleplay**!\n\nWe're looking for department members! <#1487127240515911791>!`,
  });
});

// LOGGING
async function sendTicketLog(guild, data) {
  const logChannel = await guild.channels.fetch(LOG_CHANNEL).catch(() => null);
  if (!logChannel) return;

  const embed = new EmbedBuilder().setColor(COLOR_LOG).setTimestamp();

  if (data.type === "created") {
    embed
      .setTitle("Ticket Created")
      .addFields(
        { name: "Ticket Type", value: data.ticketType, inline: true },
        { name: "Opened by", value: `<@${data.openedBy}>`, inline: true },
        { name: "Channel", value: `<#${data.channelId}>`, inline: true }
      );
  } else {
    embed
      .setTitle("Ticket Closed")
      .addFields(
        { name: "Ticket Type", value: data.ticketType, inline: true },
        { name: "Closed by", value: `<@${data.closedBy}>`, inline: true },
        { name: "Channel", value: data.channelName, inline: true }
      );
  }

  await logChannel.send({ embeds: [embed] });
}

// TRANSCRIPT SYSTEM + DM TO USER
async function sendTranscript(channel, closedBy) {
  const guild = channel.guild;
  const logChannel = await guild.channels.fetch(LOG_CHANNEL).catch(() => null);
  if (!logChannel) return;

  let messages = [];
  let lastId = null;

  while (true) {
    const fetched = await channel.messages.fetch({
      limit: 100,
      before: lastId || undefined,
    });
    if (fetched.size === 0) break;
    messages = messages.concat(Array.from(fetched.values()));
    lastId = fetched.last().id;
  }

  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const lines = messages.map((m) => {
    const time = new Date(m.createdTimestamp).toLocaleString("en-US");
    const author = m.author ? m.author.tag : "Unknown";
    const content = m.content || (m.attachments.size ? "[Attachment]" : "");
    return `[${time}] ${author}: ${content}`;
  });

  if (lines.length === 0) lines.push("[No messages in this ticket]");

  const header = new EmbedBuilder()
    .setTitle("Ticket Transcript")
    .setColor(COLOR_LOG)
    .addFields(
      { name: "Channel", value: `#${channel.name}` },
      { name: "Closed by", value: `<@${closedBy.id}>` }
    )
    .setTimestamp();

  await logChannel.send({ embeds: [header] });

  const chunkSize = 3500;
  let current = "";
  const chunks = [];

  for (const line of lines) {
    if (current.length + line.length > chunkSize) {
      chunks.push(current);
      current = "";
    }
    current += line + "\n";
  }
  if (current) chunks.push(current);

  for (const chunk of chunks) {
    await logChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(COLOR_LOG)
          .setDescription("```text\n" + chunk + "\n```"),
      ],
    });
  }

  try {
    const opener = await channel.members.fetch().then((members) =>
      members.find((m) => !m.user.bot)
    );

    if (opener) {
      await opener.send(
        `📄 Your ticket **${channel.name}** has been closed. Here is your transcript:`
      );

      for (const chunk of chunks) {
        await opener.send({
          embeds: [
            new EmbedBuilder()
              .setColor(COLOR_LOG)
              .setDescription("```text\n" + chunk + "\n```"),
          ],
        });
      }
    }
  } catch (err) {
    console.log("Could not DM transcript.");
  }
}

// INTERACTIONS
client.on("interactionCreate", async (interaction) => {
  if (!interaction.inGuild()) return;

  // TICKET CREATION
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "ticket-select"
  ) {
    const value = interaction.values[0];
    const member = interaction.member;
    const guild = interaction.guild;

    let ticketTypeName;
    let ticketTypeLabel;
    let allowedRoles = [];
    let pingText = "";
    let description = "";
    let categoryId;

    if (value === "general_support") {
      ticketTypeName = "general";
      ticketTypeLabel = "General Support";
      categoryId = CATEGORY_GENERAL;

      allowedRoles = [
        ROLES.STAFF_TEAM,
        ROLES.MODERATION_TEAM,
        ROLES.SENIOR_MODERATOR,
        ROLES.ADMINISTRATION_TEAM,
        ROLES.SENIOR_ADMINISTRATOR,
      ];

      pingText = `@here <@&${ROLES.MODERATION_TEAM}> <@&${ROLES.ADMINISTRATION_TEAM}> <@${member.id}>`;

      description =
        "Thank you for opening a **General Support** ticket.\n" +
        "Our **Moderation / Administration / Staff Team** will assist you shortly.";
    } else if (value === "high_rank_support") {
      ticketTypeName = "high-rank";
      ticketTypeLabel = "High Rank Support";
      categoryId = CATEGORY_HIGHRANK;

      allowedRoles = [ROLES.HIGH_RANK];

      pingText = `@here <@&${ROLES.HIGH_RANK}> <@${member.id}>`;

      description =
        "You have opened a **High Rank Support** ticket.\n" +
        "This is used for **appeals, staff reports, and Internal Affairs matters**.\n" +
        "This ticket is visible to **High Rank personnel only**.";
    } else if (value === "foundership_support") {
      ticketTypeName = "foundership";
      ticketTypeLabel = "Foundership Support";
      categoryId = CATEGORY_FOUNDERSHIP;

      allowedRoles = [ROLES.FOUNDERSHIP_TEAM];

      pingText = `@here <@&${ROLES.FOUNDERSHIP_TEAM}> <@${member.id}>`;

      description =
        "You have opened a **Foundership Support** ticket.\n" +
        "This ticket is **Foundership Only**.\n" +
        "Only members with the **Foundership Team** role can view and respond.";
    }

    const channelName = `ticket-${ticketTypeName}-${member.user.username}`
      .toLowerCase()
      .replace(/[^a-z0-9\-]/g, "");

    const overwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: member.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
    ];

    for (const roleId of allowedRoles) {
      overwrites.push({
        id: roleId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      });
    }

    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: categoryId,
      permissionOverwrites: overwrites,
    });

    const ticketEmbed = new EmbedBuilder()
      .setTitle("New Ticket")
      .setColor(COLOR_MAIN)
      .setDescription(description)
      .addFields(
        {
          name: "Opened by",
          value: `<@${member.id}> (${member.id})`,
          inline: true,
        },
        {
          name: "Type",
          value: ticketTypeLabel,
          inline: true,
        }
      )
      .setTimestamp();

    const claimButton = new ButtonBuilder()
      .setCustomId("claim-ticket")
      .setLabel("Claim")
      .setStyle(ButtonStyle.Primary);

    const closeButton = new ButtonBuilder()
      .setCustomId("close-ticket")
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger);

    const escalateButton = new ButtonBuilder()
      .setCustomId("escalate-ticket")
      .setLabel("Escalate")
      .setStyle(ButtonStyle.Secondary);

    const deescalateButton = new ButtonBuilder()
      .setCustomId("deescalate-ticket")
      .setLabel("De-escalate")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(
      claimButton,
      closeButton,
      escalateButton,
      deescalateButton
    );

    await ticketChannel.send({
      content: pingText,
      embeds: [ticketEmbed],
      components: [row],
    });

    await sendTicketLog(guild, {
      type: "created",
      ticketType: ticketTypeLabel,
      openedBy: member.id,
      channelId: ticketChannel.id,
    });

    return interaction.reply({
      content: `Your **${ticketTypeLabel}** ticket has been created: ${ticketChannel}`,
      ephemeral: true,
    });
  }

  // CLAIM / UNCLAIM (FIXED)
  if (interaction.isButton() && interaction.customId === "claim-ticket") {
    const channel = interaction.channel;
    const message = interaction.message;

    if (channel.cooldown) return;
    channel.cooldown = true;
    setTimeout(() => (channel.cooldown = false), 2000);

    const row = ActionRowBuilder.from(message.components[0]);

    const claimButton = ButtonBuilder.from(row.components[0]);
    const closeButton = ButtonBuilder.from(row.components[1]);

    const isClaimed = channel.name.includes("claimed-by-");

    if (!isClaimed) {
      claimButton.setLabel("Unclaim").setStyle(ButtonStyle.Secondary);

      await channel.setName(`${channel.name}-claimed-by-${interaction.member.id}`);

      await channel.send(
        `🔒 Ticket has been **claimed** by <@${interaction.member.id}>`
      );
    } else {
      claimButton.setLabel("Claim").setStyle(ButtonStyle.Primary);

      const originalName = channel.name.replace(/-claimed-by-\d+/, "");
      await channel.setName(originalName);

      await channel.send(
        `🔓 Ticket has been **unclaimed** by <@${interaction.member.id}>`
      );
    }

    row.setComponents(claimButton, closeButton);

    return interaction.update({ components: [row] });
  }

  // ESCALATE BUTTON → SHOW ROLE SELECT
  if (interaction.isButton() && interaction.customId === "escalate-ticket") {
    const member = interaction.member;

    if (
      !member.roles.cache.has(ROLES.MODERATION_TEAM) &&
      !member.roles.cache.has(ROLES.SENIOR_MODERATOR) &&
      !member.roles.cache.has(ROLES.ADMINISTRATION_TEAM) &&
      !member.roles.cache.has(ROLES.SENIOR_ADMINISTRATOR) &&
      !member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return interaction.reply({
        content: "You must be **Moderation+** to escalate a ticket.",
        ephemeral: true,
      });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId("escalate-select")
      .setPlaceholder("Select who to ping")
      .addOptions(
        { label: "High Rank", value: ROLES.HIGH_RANK },
        { label: "Foundership", value: ROLES.FOUNDERSHIP_TEAM },
        { label: "Management", value: ROLES.MANAGEMENT_TEAM },
        { label: "Admin Team", value: ROLES.ADMINISTRATION_TEAM },
        { label: "Moderation Team", value: ROLES.MODERATION_TEAM },
        { label: "Staff Team", value: ROLES.STAFF_TEAM }
      );

    const row = new ActionRowBuilder().addComponents(menu);

    return interaction.reply({
      content: "Choose who you want to ping:",
      components: [row],
      ephemeral: true,
    });
  }

  // ESCALATE SELECT MENU
  if (interaction.isStringSelectMenu() && interaction.customId === "escalate-select") {
    const roleId = interaction.values[0];
    const member = interaction.member;

    await interaction.channel.send(
      `⚠️ Ticket escalated by <@${member.id}>.\nPinging <@&${roleId}>`
    );

    return interaction.update({
      content: "Escalation sent.",
      components: []
    });
  }

  // DE-ESCALATE
  if (interaction.isButton() && interaction.customId === "deescalate-ticket") {
    const member = interaction.member;

    if (
      !member.roles.cache.has(ROLES.MODERATION_TEAM) &&
      !member.roles.cache.has(ROLES.SENIOR_MODERATOR) &&
      !member.roles.cache.has(ROLES.ADMINISTRATION_TEAM) &&
      !member.roles.cache.has(ROLES.SENIOR_ADMINISTRATOR) &&
      !member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return interaction.reply({
        content: "You must be **Moderation+** to de-escalate a ticket.",
        ephemeral: true,
      });
    }

    await interaction.channel.send(
      `✅ This ticket has been **de‑escalated** by <@${member.id}>.`
    );

    return interaction.reply({
      content: "Ticket de‑escalated.",
      ephemeral: true,
    });
  }

  // CLOSE TICKET
  if (interaction.isButton() && interaction.customId === "close-ticket") {
    const channel = interaction.channel;
    if (!channel) return;

    const guild = interaction.guild;
    const closer = interaction.member;

    await interaction.reply({
      content: "Closing ticket in 5 seconds...",
      ephemeral: true,
    });

    await sendTicketLog(guild, {
      type: "closed",
      ticketType: "Ticket",
      closedBy: closer.id,
      channelName: `#${channel.name}`,
    });

    await sendTranscript(channel, closer);

    setTimeout(()