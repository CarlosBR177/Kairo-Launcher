package gg.kairo.config;

import gg.kairo.KairoClient;
import gg.kairo.module.Module;
import gg.kairo.module.ModuleManager;
import java.util.List;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.network.chat.Component;

/**
 * Desliga módulos proibidos ao entrar num servidor listado em "serverRules"
 * e devolve tudo como estava ao sair. A escolha salva do jogador não muda.
 */
public final class ServerRules {
	private ServerRules() {}

	public static void onJoin(Minecraft mc) {
		ServerData server = mc.getCurrentServer();
		if (server == null) return;
		List<String> ids = KairoConfig.blockedModulesFor(server.ip);
		int count = 0;
		for (String id : ids) {
			Module m = ModuleManager.get(id);
			if (m == null || m.blocked) continue;
			m.block();
			count++;
		}
		if (count > 0 && mc.player != null) {
			KairoClient.LOG.info("{} módulo(s) desligado(s) pelas regras de {}", count, server.ip);
			mc.player.displayClientMessage(Component.literal("§d[Kairo] §7" + count
					+ (count == 1 ? " módulo desligado" : " módulos desligados") + " neste servidor: §f" + String.join(", ", ids)), false);
		}
	}

	public static void onLeave() {
		for (Module m : ModuleManager.all()) m.unblock();
	}
}
