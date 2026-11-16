package gg.kairo.mixin;

import net.minecraft.client.OptionInstance;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

/** Permite pôr o gama acima do limite do menu (Brilho máximo). */
@Mixin(OptionInstance.class)
public interface OptionInstanceAccessor {
	@Accessor("value")
	void kairo$setValue(Object value);
}
