# Importação de contracheques em lote

Disponível para administradores em **Importar Contracheques**, abaixo de Dashboard.
Selecione mês/ano e até 300 PDFs (5 MB por arquivo), confira a lista e clique em
**Importar todos**. O navegador envia até três PDFs simultaneamente e mostra o
resultado individual. Mantenha a página aberta até o fim. Em falha parcial, o
mesmo botão tenta novamente somente os arquivos pendentes.

O nome deve seguir `CPF - NOME MM-AAAA.pdf`, com 11 dígitos no CPF e competência
igual à selecionada. A comparação com `users.cpf` remove pontuação/espaços/barras
e completa zeros à esquerda. CPF sem usuário, ambíguo ou repetido no lote é
sinalizado e não recebe upload. Nenhum vínculo é feito pelo nome da pessoa.

A conferência usa somente metadados. A autorização por arquivo expira em quatro
horas e vincula administrador, usuário, CPF, competência, nome e tamanho. O envio
reconfere esses dados e o cabeçalho PDF no servidor. Apenas o clique de importação
envia os documentos ao Google Drive e grava os vínculos no banco.

Registros ativos para `user_id + mes + ano` são mantidos. Registros inativos são
reativados com o novo PDF. A gravação usa transação, bloqueio do usuário e o índice
único existente `uq_contracheque_user_mes_ano`. Repetir um envio concluído não cria
outro contracheque. Se a gravação falhar antes do COMMIT, o novo arquivo sem vínculo
é removido do Drive; falhas de limpeza são registradas no servidor. Se a confirmação
do COMMIT falhar, o PDF é preservado porque o vínculo pode já ter sido confirmado.
Arquivos antigos de registros reativados são preservados no Drive.

## Publicação e reversão

Não há migração de banco. Requer MySQL 8 (REGEXP_REPLACE), a configuração atual do
Drive e JWT_SECRET. Publicar backend e frontend do mesmo commit: o workflow Pages
publica somente o frontend; o backend precisa receber o deploy no Render.

Para desfazer o código, execute `git revert <commit-da-importacao>` e `git push
origin main`, e publique também o backend. Reverter código não desfaz importações
já concluídas; os documentos continuam gerenciáveis em Remover Contracheque.

## Verificação

- Backend: `node --test src/services/contrachequeImport.test.js src/routes/contrachequeImport.test.js`
- Frontend: `npm test -- --watchAll=false --runInBand --testPathPattern=PaycheckImport`
- Build: `npm run build`

Os testes automatizados de upload usam Drive/banco simulados, sem enviar PDFs reais.
