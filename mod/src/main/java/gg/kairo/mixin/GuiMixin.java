package gg.kairo.mixin;

import net.minecraft.client.gui.Gui;
import org.spongepowered.asm.mixin.Mixin;
//? if <26.1 {
/*import com.llamalad7.mixinextras.sugar.Local;
import gg.kairo.compat.Gfx;
import gg.kairo.module.ModuleManager;
import gg.kairo.module.impl.CrosshairModule;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
*///?}

/** Mira personalizada nas 1.21.x. Na 26.x a troca é feita pela Fabric API (KairoClient). */
@Mixin(Gui.class)
public class GuiMixin {
	//? if <26.1 {
	/*@Inject(method = "renderCrosshair", at = @At("HEAD"), cancellable = true, require = 0)
	private void kairo$crosshair(CallbackInfo ci, @Local(argsOnly = true) GuiGraphics raw) {
		if (ModuleManager.get("crosshair") instanceof CrosshairModule c && c.enabled) {
			c.render(new Gfx(raw), Minecraft.getInstance());
			ci.cancel();
		}
	}
	*///?}
}
