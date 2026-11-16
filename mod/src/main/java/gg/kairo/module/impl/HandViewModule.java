package gg.kairo.module.impl;

import com.google.gson.JsonObject;
import gg.kairo.config.Opt;
import gg.kairo.module.Module;

/**
 * Tamanho e posição do item na mão em primeira pessoa.
 * "Escudo baixo": desce só a mão secundária. Mixin: ItemInHandRendererMixin.
 */
public final class HandViewModule extends Module {
	public static HandViewModule INSTANCE;

	public double scale = 1.0;
	public double x = 0.0;
	public double y = 0.0;
	public double z = 0.0;
	public double offhandY = -0.15;

	public HandViewModule() {
		super("handview", "Item na mão", "Tamanho e posição do item na mão, e escudo mais baixo.", false);
		INSTANCE = this;
	}

	@Override
	public void readOptions(JsonObject o) {
		scale = Opt.d(o, "scale", scale, 0.3, 1.5);
		x = Opt.d(o, "x", x, -1, 1);
		y = Opt.d(o, "y", y, -1, 1);
		z = Opt.d(o, "z", z, -1, 1);
		offhandY = Opt.d(o, "offhandY", offhandY, -1, 0.5);
	}

	@Override
	public void writeOptions(JsonObject o) {
		o.addProperty("scale", scale);
		o.addProperty("x", x);
		o.addProperty("y", y);
		o.addProperty("z", z);
		o.addProperty("offhandY", offhandY);
	}
}
