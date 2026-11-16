package gg.kairo.module.impl;

import gg.kairo.module.TextHudModule;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientPacketListener;
import net.minecraft.client.multiplayer.PlayerInfo;

public final class PingModule extends TextHudModule {
	public PingModule() {
		super("ping", "Ping", "Latência até o servidor.", true, 4, 40);
	}

	@Override
	protected String label() {
		return "Ping";
	}

	@Override
	protected String value(Minecraft mc, boolean preview) {
		ClientPacketListener conn = mc.getConnection();
		if (conn == null || mc.player == null) return preview ? "42ms" : "-";
		if (mc.hasSingleplayerServer()) return "local";
		PlayerInfo info = conn.getPlayerInfo(mc.player.getUUID());
		return info == null ? "-" : info.getLatency() + "ms";
	}
}
