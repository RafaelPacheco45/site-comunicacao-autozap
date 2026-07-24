# AutoZap Comunicação

Canal público de comunicação com fornecedores da AutoZap. Site estático em duas etapas:

1. **Cadastro** — a empresa fornecedora preenche um pré-cadastro (nome, empresa, CNPJ, contato, cidade/UF, categoria).
2. **Mensagem** — depois do cadastro, envia uma mensagem contando sobre sua proposta. A partir daí, a negociação continua por e-mail.

Sem login. Cada envio vira um "lead" para revisão manual do time — não cria fornecedor real automaticamente (isso continua sendo feito manualmente via painel admin do backend).

## Stack

HTML + CSS + JavaScript puro, sem build step, sem dependências.

```
index.html
css/style.css
js/app.js
assets/        # logo, banner, favicons, imagem de compartilhamento (og-image)
```

## Backend

O formulário envia para a API pública já existente em `https://aip.autozap.log.br`:

- `POST /public/fornecedor-lead`
- `POST /public/fornecedor-lead/:id/mensagens`

Sem autenticação, com rate limit. Ver `API_CONFIG` no topo de `js/app.js` para trocar o endpoint, se necessário.

## Rodando localmente

Não precisa de servidor — basta abrir `index.html` direto no navegador.
