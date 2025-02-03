// Importar dependências
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// Inicializar o Express
const app = express();
const port = process.env.PORT || 3000;

// Usar o body-parser para processar dados JSON
app.use(bodyParser.json());

// Rota de verificação do webhook (Facebook exige isso)
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN; // Token de verificação

  // Verifica se o parâmetro 'hub.verify_token' é válido
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook de verificação bem-sucedido!');
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Token de verificação inválido');
    }
  }
});

// Rota para receber os comentários do webhook
app.post('/webhook', async (req, res) => {
  const data = req.body;

  // Verifica se a notificação é sobre um comentário
  if (data.entry && data.entry[0].changes) {
    const comment = data.entry[0].changes[0].value;

    // Verifique se é um comentário (não uma curtida)
    if (comment && comment.message) {
      console.log('Novo comentário recebido:', comment.message);
      const commentId = comment.comment_id;
      const message = comment.message;

      // Enviar o comentário para o ODA para processar
      await sendToODA(commentId, message);
    }
  }

  res.status(200).send('Evento recebido com sucesso');
});

// Função para enviar o comentário para o ODA
const sendToODA = async (commentId, message) => {
  const odaEndpoint = process.env.ODA_ENDPOINT;
  const odaBotToken = process.env.ODA_BOT_TOKEN;

  const data = {
    "input": {
      "message": message,
      "commentId": commentId
    },
    "context": {
      "user": {
        "id": "user_123"  // ID fictício de usuário, altere conforme necessário
      }
    }
  };

  try {
    const response = await axios.post(odaEndpoint, data, {
      headers: {
        'Authorization': `Bearer ${odaBotToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Resposta do ODA:', response.data);

    // Verifica se o ODA gerou uma resposta
    const replyMessage = response.data.output.text;
    if (replyMessage) {
      console.log('Resposta gerada pelo ODA:', replyMessage);
      // Responde ao comentário no Facebook
      await replyToComment(commentId, replyMessage);
    } else {
      console.log('O ODA não gerou uma resposta.');
    }
  } catch (error) {
    console.error('Erro ao enviar para o ODA:', error);
  }
};

// Função para responder ao comentário no Facebook
const replyToComment = async (commentId, message) => {
  const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN;

  try {
    const response = await axios.post(`https://graph.facebook.com/v12.0/${commentId}/comments`, {
      message: message,
      access_token: pageAccessToken
    });

    console.log('Comentário respondido com sucesso:', response.data);
  } catch (error) {
    console.error('Erro ao responder comentário:', error);
  }
};

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
