# Publicar Bombástico na Google Play

## 1. Uma vez só: criar a chave de assinatura

```
keytool -genkeypair -v -keystore bombastico-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Guarde o arquivo `.jks` e as senhas em um cofre de senhas e faça backup fora do computador.
Depois crie `android/keystore.properties` (já está no .gitignore, nunca vai para o git):

```
storeFile=../bombastico-upload.jks
storePassword=SUA_SENHA
keyAlias=upload
keyPassword=SUA_SENHA
```

Com o Play App Signing (padrão), essa é só a chave de *upload*: se perder, o Google permite redefinir.

## 2. Gerar o pacote

```
npm run check            # lint + testes + build
npm run icons            # só se mudou o ícone
npm run android:bundle   # gera o .aab assinado
```

Arquivo: `android/app/build/outputs/bundle/release/app-release.aab`.
Para cada nova versão, aumente `versionCode` (e `versionName`) em `android/app/build.gradle`.

## 3. Conta e app no Play Console

1. Crie a conta em https://play.google.com/console (taxa única de US$ 25) e conclua a verificação de identidade.
2. **Criar app**: nome "Bombástico", idioma português (Brasil), tipo Jogo, gratuito.
3. Ficha da loja: descrição curta (80 caracteres) e completa, ícone `store/icon-512.png`, **imagem de destaque 1024x500** e **ao menos 2 capturas de tela** do celular (você precisa criar).
4. Política de privacidade: precisa de uma URL pública (veja abaixo).
5. Segurança dos dados: o app não coleta nem compartilha dados, não tem internet. Marque "não coleta".
6. Classificação etária: responda o questionário (violência de desenho animado, sem compras).
7. Público-alvo: se incluir menores de 13 anos, entra na política de Famílias (mais regras). Escolha com cuidado.
8. Anúncios: "não contém anúncios" (se mudar no futuro, atualize).

## 4. Testes obrigatórios (contas pessoais novas)

Contas pessoais criadas depois de nov/2023 precisam rodar um **teste fechado com pelo menos 12 testadores por 14 dias seguidos** antes de pedir produção. Contas de organização (CNPJ) não têm essa exigência.
Crie a faixa de teste fechado, envie o `.aab`, adicione os e-mails (ou um grupo do Google) e peça que instalem pelo link.

## 5. Produção

Após os 14 dias: *Produção > Criar versão*, envie o `.aab`, escreva as notas da versão e envie para análise (costuma levar de horas a alguns dias).

## Precisa de domínio?

**Não.** A Play Store não exige domínio nem site. O que exige é uma **URL pública da política de privacidade**.
Opção gratuita: publicar uma página no GitHub Pages do repositório. O app não usa internet, então o texto pode ser curto: não coleta dados pessoais; apelido e recorde ficam só no aparelho.
Também é pedido um e-mail de contato público. Um domínio próprio só vale a pena se quiser site/e-mail profissional.
