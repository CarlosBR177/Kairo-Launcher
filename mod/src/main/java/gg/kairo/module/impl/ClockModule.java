package gg.kairo.module.impl;

import gg.kairo.module.TextHudModule;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import net.minecraft.client.Minecraft;

public final class ClockModule extends TextHudModule {
	private static final DateTimeFormatter FORMAT = DateTimeFormatter.ofPattern("HH:mm");

	public ClockModule() {
		super("clock", "Relógio", "Hora atual do seu PC.", false, 4, 58);
	}

	@Override
	protected String label() {
		return "Hora";
	}

	@Override
	protected String value(Minecraft mc, boolean preview) {
		return LocalTime.now().format(FORMAT);
	}
}
