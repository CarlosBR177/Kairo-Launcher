# Política de Privacidade — Kairo Launcher

*Última atualização: 16 de novembro de 2026*

O Kairo Launcher e o Kairo Client (o "Kairo") são um projeto independente. Esta política explica, em linguagem simples, quais dados o Kairo usa, onde eles ficam e com quem são trocados.

**Resumo:** o Kairo não tem servidor próprio, não coleta estatísticas de uso e não vende nem compartilha os seus dados. Tudo o que ele guarda fica no seu computador.

## 1. O que o Kairo guarda no seu computador

Na pasta `%APPDATA%\KairoLauncher` (Windows):

- **Conta:** nome de jogador, UUID e os tokens de acesso da Microsoft/Minecraft necessários para entrar no jogo sem pedir a senha toda vez. **A sua senha nunca passa pelo Kairo**: o login é feito na página da própria Microsoft.
- **Instâncias e configurações:** versões do jogo, mods, memória, servidores favoritos, cor do tema, ajustes do Kairo Client e tempo jogado.
- **Arquivos do jogo:** Minecraft, bibliotecas, Java e mods baixados.

Você pode apagar tudo isso a qualquer momento: remova a conta pelo launcher ou apague essa pasta.

## 2. Com quem o Kairo se comunica

O Kairo só se conecta a serviços necessários para o jogo funcionar:

| Serviço | Para quê | O que é enviado |
|---|---|---|
| Microsoft / Xbox Live (`login.microsoftonline.com`, `*.xboxlive.com`) | Login da sua conta | Os dados do login que você autoriza na tela da Microsoft |
| Mojang / Minecraft (`*.minecraft.net`, `*.mojang.com`, `api.minecraftservices.com`) | Verificar a licença, baixar o jogo e o Java | Token da conta e pedidos de download |
| Fabric (`meta.fabricmc.net`) | Baixar o Fabric | Pedidos de download |
| Modrinth (`api.modrinth.com`) | Buscar e baixar mods | Termos de busca e a versão do jogo |
| mc-heads.net | Mostrar a cabeça do seu personagem | Nome/UUID do jogador |
| GitHub (`github.com`, `api.github.com`) | Procurar atualizações e mostrar as novidades | Pedido da versão mais recente |
| Discord (no seu computador) | Rich Presence: mostrar "Jogando Kairo PvP" no seu perfil | Nome e versão da instância, servidor em que você está e tempo de jogo. Só acontece com o Discord aberto e pode ser desligado em **Ajustes** |
| Servidores de Minecraft | Mostrar status/jogadores dos servidores e entrar neles | O mesmo que o Minecraft normal envia |

Cada um desses serviços tem a sua própria política de privacidade.

## 3. Permissões da tela de login da Microsoft

- **Perfil do Xbox Live:** é o que permite entrar no Minecraft com a sua conta Microsoft.
- **Manter o acesso:** permite renovar o login sozinho, sem pedir para você entrar de novo. Você pode revogar a qualquer momento em <https://microsoft.com/consent>.

## 4. Crianças

O Kairo não coleta dados de ninguém. Contas de menores seguem as regras de conta da Microsoft.

## 5. Seus direitos (LGPD)

Como os dados ficam só no seu computador, você tem controle total sobre eles: pode ver, corrigir ou apagar apagando a pasta indicada acima. Em caso de dúvida, fale com a gente.

## 6. Mudanças nesta política

Se esta política mudar, a nova versão será publicada neste mesmo endereço, com a data atualizada.

## 7. Contato

Abra uma *issue* em <https://github.com/CarlosBR177/Kairo-Launcher/issues>.

---

*O Kairo não é um produto oficial do Minecraft. Não é aprovado nem associado à Mojang ou à Microsoft.*
