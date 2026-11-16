package gg.kairo.module;

import gg.kairo.module.impl.ArmorModule;
import gg.kairo.module.impl.ClockModule;
import gg.kairo.module.impl.ComboModule;
import gg.kairo.module.impl.CoordsModule;
import gg.kairo.module.impl.CpsModule;
import gg.kairo.module.impl.CrosshairModule;
import gg.kairo.module.impl.FpsModule;
import gg.kairo.module.impl.FreelookModule;
import gg.kairo.module.impl.FullbrightModule;
import gg.kairo.module.impl.HandViewModule;
import gg.kairo.module.impl.ItemCounterModule;
import gg.kairo.module.impl.KeystrokesModule;
import gg.kairo.module.impl.LowFireModule;
import gg.kairo.module.impl.ParticlesModule;
import gg.kairo.module.impl.PingModule;
import gg.kairo.module.impl.PotionsModule;
import gg.kairo.module.impl.ToggleSneakModule;
import gg.kairo.module.impl.ToggleSprintModule;
import gg.kairo.module.impl.ZoomModule;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import net.minecraft.client.Minecraft;

public final class ModuleManager {
	private static final List<Module> MODULES = new ArrayList<>();

	private ModuleManager() {}

	public static void init() {
		if (!MODULES.isEmpty()) return;
		MODULES.add(new FpsModule());
		MODULES.add(new CpsModule());
		MODULES.add(new PingModule());
		MODULES.add(new ClockModule());
		MODULES.add(new CoordsModule());
		MODULES.add(new KeystrokesModule());
		MODULES.add(new FreelookModule());
		MODULES.add(new ZoomModule());
		MODULES.add(new ToggleSprintModule());
		// PvP
		MODULES.add(new ComboModule());
		MODULES.add(new PotionsModule());
		MODULES.add(new ArmorModule());
		MODULES.add(new ItemCounterModule());
		MODULES.add(new CrosshairModule());
		MODULES.add(new ToggleSneakModule());
		// visual
		MODULES.add(new LowFireModule());
		MODULES.add(new HandViewModule());
		MODULES.add(new FullbrightModule());
		MODULES.add(new ParticlesModule());
	}

	public static List<Module> all() {
		return Collections.unmodifiableList(MODULES);
	}

	public static List<HudModule> hud() {
		List<HudModule> out = new ArrayList<>();
		for (Module m : MODULES) if (m instanceof HudModule h) out.add(h);
		return out;
	}

	public static Module get(String id) {
		for (Module m : MODULES) if (m.id.equals(id)) return m;
		return null;
	}

	public static void tick(Minecraft mc) {
		for (Module m : MODULES) m.tick(mc);
	}
}
