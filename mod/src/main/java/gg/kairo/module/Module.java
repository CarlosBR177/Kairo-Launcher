package gg.kairo.module;

import com.google.gson.JsonObject;
import net.minecraft.client.Minecraft;

/** Base de todo módulo do Kairo. */
public abstract class Module {
	public final String id;
	public final String name;
	public final String description;
	public boolean enabled;

	/** Desligado à força porque o servidor atual proíbe (ver ServerRules). */
	public boolean blocked;
	private boolean enabledBeforeBlock;

	protected Module(String id, String name, String description, boolean enabledByDefault) {
		this.id = id;
		this.name = name;
		this.description = description;
		this.enabled = enabledByDefault;
	}

	public void toggle() {
		if (blocked) return;
		setEnabled(!enabled);
	}

	public void setEnabled(boolean value) {
		if (value == enabled) return;
		enabled = value;
		onToggle(Minecraft.getInstance());
	}

	public void block() {
		if (blocked) return;
		enabledBeforeBlock = enabled;
		setEnabled(false);
		blocked = true;
	}

	public void unblock() {
		if (!blocked) return;
		blocked = false;
		setEnabled(enabledBeforeBlock);
	}

	/** Estado que vai para o arquivo: um bloqueio do servidor não muda a escolha do jogador. */
	public boolean savedEnabled() {
		return blocked ? enabledBeforeBlock : enabled;
	}

	/** Chamado a cada tick do cliente (20x/s), mesmo desligado. */
	public void tick(Minecraft mc) {}

	protected void onToggle(Minecraft mc) {}

	/** Opções extras do módulo, no mesmo objeto de "modules.<id>" do kairo.json. */
	public void readOptions(JsonObject o) {}

	public void writeOptions(JsonObject o) {}
}
