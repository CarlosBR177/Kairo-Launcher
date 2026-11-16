package gg.kairo.module.impl;

import com.google.gson.JsonObject;
import gg.kairo.config.Opt;
import gg.kairo.module.Module;

/** Baixa (ou esconde) o fogo que cobre a tela quando você está pegando fogo. Mixin: ScreenEffectRendererMixin. */
public final class LowFireModule extends Module {
	public static LowFireModule INSTANCE;

	/** Quanto descer o fogo, de 0 (vanilla) a 0.5 (quase fora da tela). */
	public double offset = 0.3;
	public boolean hide = false;

	public LowFireModule() {
		super("lowfire", "Fogo baixo", "Desce o fogo da tela para ele não atrapalhar a visão.", true);
		INSTANCE = this;
	}

	@Override
	public void readOptions(JsonObject o) {
		offset = Opt.d(o, "offset", offset, 0, 0.5);
		hide = Opt.b(o, "hide", hide);
	}

	@Override
	public void writeOptions(JsonObject o) {
		o.addProperty("offset", offset);
		o.addProperty("hide", hide);
	}
}
