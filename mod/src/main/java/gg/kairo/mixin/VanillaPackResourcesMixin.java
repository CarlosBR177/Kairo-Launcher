package gg.kairo.mixin;

import gg.kairo.KairoClient;
import java.io.InputStream;
import net.minecraft.server.packs.PackType;
import net.minecraft.server.packs.VanillaPackResources;
import net.minecraft.server.packs.resources.IoSupplier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
//? if >=1.21.11 {
import net.minecraft.resources.Identifier;
//?} else {
/*import net.minecraft.resources.ResourceLocation;
*///?}

/**
 * Tela de carregamento do Kairo: o logo "Mojang Studios" é lido direto do pacote vanilla
 * (não passa por resource packs), então trocamos a imagem aqui. O fundo escuro vem da opção
 * "Fundo monocromático" do jogo, que o launcher liga no options.txt.
 * require = 0: se a classe mudar numa versão nova, aparece o logo da Mojang e o jogo abre normal.
 */
@Mixin(VanillaPackResources.class)
public class VanillaPackResourcesMixin {
	private static final String KAIRO_LOGO = "/assets/kairo/textures/gui/loading_logo.png";

	//? if >=1.21.11 {
	@Inject(method = "getResource", at = @At("HEAD"), cancellable = true, require = 0)
	private void kairo$loadingLogo(PackType type, Identifier id, CallbackInfoReturnable<IoSupplier<InputStream>> cir) {
		kairo$swap(type, id.getNamespace(), id.getPath(), cir);
	}
	//?} else {
	/*@Inject(method = "getResource", at = @At("HEAD"), cancellable = true, require = 0)
	private void kairo$loadingLogo(PackType type, ResourceLocation id, CallbackInfoReturnable<IoSupplier<InputStream>> cir) {
		kairo$swap(type, id.getNamespace(), id.getPath(), cir);
	}
	*///?}

	private static void kairo$swap(PackType type, String namespace, String path, CallbackInfoReturnable<IoSupplier<InputStream>> cir) {
		if (type != PackType.CLIENT_RESOURCES || !"minecraft".equals(namespace)
				|| !"textures/gui/title/mojangstudios.png".equals(path)) {
			return;
		}
		// (a classe do mixin não pode ser usada em tempo de execução; o jar é o mesmo do KairoClient)
		if (KairoClient.class.getResource(KAIRO_LOGO) == null) return;
		cir.setReturnValue(() -> KairoClient.class.getResourceAsStream(KAIRO_LOGO));
	}
}
