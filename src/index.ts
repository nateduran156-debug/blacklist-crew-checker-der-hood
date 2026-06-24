import "dotenv/config";
import {
  Client, GatewayIntentBits, Collection, Events, REST, Routes,
  TextChannel, GuildMember, ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags, SeparatorSpacingSize,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { db, trackedGuilds, userTokens } from "./db.js";
import { LOG_CHANNEL_ID, PING_USER_ID } from "./constants.js";
import * as check from "./commands/check.js";
import * as addblcrew from "./commands/addblcrew.js";
import * as adduser from "./commands/adduser.js";
import * as bl from "./commands/bl.js";
import * as setRole from "./commands/setRole.js";
import * as setlog from "./commands/setlog.js";
import * as showlist from "./commands/showlist.js";
import * as checkall from "./commands/checkall.js";

interface Command {
  data: { name: string; toJSON(): unknown };
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const commands = new Collection<string, Command>();
commands.set(check.data.name, check);
commands.set(addblcrew.data.name, addblcrew);
commands.set(adduser.data.name, adduser);
commands.set(bl.data.name, bl);
commands.set(setRole.data.name, setRole);
commands.set(setlog.data.name, setlog);
commands.set(showlist.data.name, showlist);
commands.set(checkall.data.name, checkall);

const DISCORD_API = "https://discord.com/api/v10";

async function isMember(token: string, guildId: string, userId: string): Promise<boolean | null> {
  try {
    const r = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, { headers: { Authorization: token } });
    if (r.status === 200) return true;
    if (r.status === 404) return false;
    return null;
  } catch { return null; }
}

async function runAutoCheck(member: GuildMember) {
  try {
    const allTokens = await db.select().from(userTokens);
    if (!allTokens.length) return;
    const activeToken = allTokens[allTokens.length - 1];
    const allTracked = await db.select().from(trackedGuilds);
    if (!allTracked.length) return;

    const found: string[] = [];
    for (const t of allTracked) {
      const r = await isMember(activeToken.token, t.guildId, member.id);
      if (r === true) found.push(t.guildName);
    }

    const isSpy = found.length > 0;
    const now = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });

    const header = new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${isSpy ? "🚨" : "🔎"} **Join Check — ${member.user.username}**`))
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(member.user.displayAvatarURL({ size: 64 })));

    const container = new ContainerBuilder()
      .setAccentColor(isSpy ? 0xe74c3c : 0x2ecc71)
      .addSectionComponents(header)
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

    if (isSpy) {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `🚨 **In these blacklisted crews (${found.length})**\n${found.map(n => `• ${n}`).join("\n")}`
      ));
    } else {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent("Free to be verified 👍"));
    }

    container
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# /getruin • Token: ${activeToken.label} • Today at ${now}`));

    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (logChannel && logChannel.isTextBased()) {
      await (logChannel as TextChannel).send({ flags: MessageFlags.IsComponentsV2, components: [container] });
    }

    try {
      const pingUser = await client.users.fetch(PING_USER_ID);
      const dmContent = isSpy
        ? `🚨 **Spy detected joining your server!**\n**User:** ${member.user.username} (<@${member.id}>)\n**Server:** ${member.guild.name}\n**Found in:**\n${found.map(n => `• ${n}`).join("\n")}`
        : `🔎 **New member joined — ${member.user.username}**\n**Server:** ${member.guild.name}\n\nFree to be verified 👍`;
      await pingUser.send({
        flags: MessageFlags.IsComponentsV2,
        components: [new ContainerBuilder().setAccentColor(isSpy ? 0xe74c3c : 0x2ecc71)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(dmContent))],
      });
    } catch { console.warn("Could not DM ping user"); }
  } catch (err) { console.error("Auto-check on join failed:", err); }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);
  const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
  await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), {
    body: [check.data, addblcrew.data, adduser.data, bl.data, setRole.data, setlog.data, showlist.data, checkall.data].map(c => c.toJSON()),
  });
  console.log("✅ Slash commands registered");
});

client.on(Events.GuildMemberAdd, async (member) => {
  console.log(`New member: ${member.user.username} in ${member.guild.name}`);
  await runAutoCheck(member);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);
    const msg = { content: "❌ Something went wrong.", ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
    else await interaction.reply(msg).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
