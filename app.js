
/* Diagnóstico público Prospera Goiás / Rio Grande do Sul — GitHub Pages. */

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxh3NWg4tnmhQzTg2D-p0lGlr6GXca5zwslqjKIC-druOA9TXSk_cpw6rvDsVHDI36agw/exec';

const form = document.getElementById('formulario');
const btn = document.getElementById('submitBtn');
const statusEl = document.getElementById('statusEnvio');
const sucesso = document.getElementById('successMessage');
const el = id => document.getElementById(id);

let ultimoIdPendente = null;

function somenteDigitos(v) {
  return String(v || '').replace(/\D/g, '');
}

function addZeros(x) {
  return String(x).padStart(2, '0');
}

function horarioAgora() {
  const d = new Date();
  return addZeros(d.getHours()) + ':' + addZeros(d.getMinutes());
}

function dataHoje() {
  const d = new Date();
  return d.getFullYear() + '-' +
    addZeros(d.getMonth() + 1) + '-' + addZeros(d.getDate());
}

function mudarObrigatorio(grupoId, ativo) {
  const grupo = el(grupoId);
  if (!grupo) return;

  grupo.style.display = ativo ? 'block' : 'none';

  grupo.querySelectorAll('input,select,textarea').forEach(c => {
    c.required = ativo;
    if (!ativo) c.value = '';
  });
}

function condicaoDetalhes() {
  mudarObrigatorio(
    'grupo_dificuldade_2',
    el('dificuldade').value === 'Sim'
  );

  mudarObrigatorio(
    'grupo_curso_detalhe',
    el('curso').value === 'Sim'
  );
}

function alternarDocumento() {
  const tipo = form.querySelector(
    'input[name="tipo_documento"]:checked'
  )?.value;

  mudarObrigatorio('grupo_cpf', tipo === 'cpf');
  mudarObrigatorio('grupo_cnpj', tipo === 'cnpj');
}

function estadoAtual() {
  return el('projeto').value;
}

async function carregarMunicipios() {
  const uf = estadoAtual();

  el('uf').value = uf;
  el('municipio').value = '';
  el('bairro').value = '';
  el('listaMunicipios').innerHTML = '';
  el('listaBairros').innerHTML = '';

  if (!uf) return;

  statusEl.textContent = 'Carregando municípios...';

  try {
    const r = await fetch(
      'https://servicodados.ibge.gov.br/api/v1/localidades/estados/' +
      uf + '/municipios?orderBy=nome'
    );

    if (!r.ok) throw Error('Falha na consulta ao IBGE');

    const itens = await r.json();

    if (uf !== estadoAtual()) return;

    el('listaMunicipios').replaceChildren(
      ...itens.map(item => {
        const o = document.createElement('option');
        o.value = item.nome;
        return o;
      })
    );

    statusEl.textContent = '';

  } catch (ex) {
    statusEl.textContent =
      'Digite o município manualmente.';
  }
}

async function buscarCEP() {
  const cep = somenteDigitos(el('cep').value);

  if (cep.length !== 8) return;

  try {
    const r = await fetch(
      'https://viacep.com.br/ws/' + cep + '/json/'
    );

    const d = await r.json();

    if (d.erro) return;

    if (!estadoAtual()) {
      statusEl.textContent = 'Selecione o estado.';
      return;
    }

    if (d.uf !== estadoAtual()) {
      statusEl.textContent =
        'O CEP corresponde a outro estado. Confira o endereço.';

      el('cep').setCustomValidity(
        'CEP não corresponde ao estado escolhido.'
      );
      return;
    }

    el('cep').setCustomValidity('');

    if (d.localidade) {
      el('municipio').value = d.localidade;
    }

    if (d.bairro) {
      el('bairro').value = d.bairro;

      const opt = document.createElement('option');
      opt.value = d.bairro;

      el('listaBairros').replaceChildren(opt);
    }

    if (d.logradouro && !el('logradouro').value) {
      el('logradouro').value = d.logradouro;
    }

    if (d.ddd && !el('ddd').value) {
      el('ddd').value = d.ddd;
    }

    statusEl.textContent =
      'Endereço localizado. Confira os dados.';

  } catch (ex) {
    statusEl.textContent =
      'Preencha o endereço manualmente.';
  }
}

function validarCPF(valor) {
  const s = somenteDigitos(valor);

  if (s.length !== 11 || /^(\d)\1+$/.test(s)) {
    return false;
  }

  for (let tamanho = 9; tamanho <= 10; tamanho++) {
    let soma = 0;

    for (let i = 0; i < tamanho; i++) {
      soma += Number(s[i]) * (tamanho + 1 - i);
    }

    const dv = (soma * 10) % 11;

    if (Number(s[tamanho]) !== (dv === 10 ? 0 : dv)) {
      return false;
    }
  }

  return true;
}

function validarCNPJ(valor) {
  const s = somenteDigitos(valor);

  if (s.length !== 14 || /^(\d)\1+$/.test(s)) {
    return false;
  }

  const dv = (parte, pesos) => {
    const soma = pesos.reduce(
      (a, p, i) => a + Number(parte[i]) * p, 0
    );

    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return Number(s[12]) === dv(
    s.slice(0, 12),
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  ) && Number(s[13]) === dv(
    s.slice(0, 13),
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  );
}

function formatarCampos() {
  el('cpf').addEventListener('input', () => {
    const s = somenteDigitos(el('cpf').value).slice(0, 11);

    el('cpf').value = s
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  });

  el('cnpj').addEventListener('input', () => {
    const s = somenteDigitos(el('cnpj').value).slice(0, 14);

    el('cnpj').value = s
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)$/, '$1-$2');
  });

  el('cep').addEventListener('input', () => {
    const s = somenteDigitos(el('cep').value).slice(0, 8);

    el('cep').value = s.replace(
      /(\d{5})(\d)/, '$1-$2'
    );

    el('cep').setCustomValidity('');
  });

  for (const id of ['ddd', 'telefone']) {
    el(id).addEventListener('input', () => {
      el(id).value = somenteDigitos(el(id).value)
        .slice(0, id === 'ddd' ? 2 : 9);
    });
  }

  el('cep').addEventListener('blur', buscarCEP);
}

function validarForm() {
  if (!form.checkValidity()) {
    form.reportValidity();
    return false;
  }

  const doc = form.querySelector(
    'input[name="tipo_documento"]:checked'
  )?.value;

  if (!doc) {
    statusEl.textContent = 'Selecione CPF ou CNPJ.';
    el('tipo_cpf').focus();
    return false;
  }

  if (doc === 'cpf' && !validarCPF(el('cpf').value)) {
    statusEl.textContent = 'Confira o CPF informado.';
    el('cpf').focus();
    return false;
  }

  if (doc === 'cnpj' && !validarCNPJ(el('cnpj').value)) {
    statusEl.textContent = 'Confira o CNPJ informado.';
    el('cnpj').focus();
    return false;
  }

  if (
    somenteDigitos(el('ddd').value).length !== 2 ||
    ![8, 9].includes(
      somenteDigitos(el('telefone').value).length
    )
  ) {
    statusEl.textContent =
      'Confira o DDD e o telefone.';
    el('telefone').focus();
    return false;
  }

  if (somenteDigitos(el('cep').value).length !== 8) {
    statusEl.textContent = 'Informe um CEP válido.';
    el('cep').focus();
    return false;
  }

  return true;
}

function gerarId() {
  return crypto.randomUUID();
}

function checarStatusJSONP(id) {
  return new Promise(resolve => {
    const nome =
      'callbackStatus_' + Math.floor(Math.random() * 1e9);

    const script = document.createElement('script');
    let finalizado = false;

    function fim(valor) {
      if (finalizado) return;

      finalizado = true;
      delete window[nome];
      script.remove();
      clearTimeout(t);
      resolve(valor);
    }

    window[nome] = d => fim(Boolean(d && d.salvo));

    script.onerror = () => fim(false);

    script.src =
      GOOGLE_SCRIPT_URL +
      '?acao=status&id=' + encodeURIComponent(id) +
      '&callback=' + nome +
      '&t=' + Date.now();

    const t = setTimeout(() => fim(false), 4500);

    document.head.appendChild(script);
  });
}

async function confirmarRegistro(id) {
  for (let tent = 0; tent < 5; tent++) {
    await new Promise(
      r => setTimeout(r, 1200 * (tent + 1))
    );

    if (await checarStatusJSONP(id)) {
      return true;
    }
  }

  return false;
}

form.addEventListener('submit', async ev => {
  ev.preventDefault();

  sucesso.classList.remove('show');

  if (!el('fim').value) {
    el('fim').value = horarioAgora();
  }

  if (!validarForm()) return;

  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const dados = Object.fromEntries(
    new FormData(form).entries()
  );

  dados.id_registro = ultimoIdPendente || gerarId();
  ultimoIdPendente = dados.id_registro;

  dados.uf = dados.projeto;
  dados.localizacao =
    dados.municipio + ' — ' + dados.bairro;

  dados.telefone_completo =
    '(' + dados.ddd + ') ' + dados.telefone;

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8'
      },
      body: JSON.stringify(dados)
    });

    statusEl.textContent =
      'Estamos confirmando o recebimento do seu diagnóstico...';

    const confirmado = await confirmarRegistro(
      dados.id_registro
    );

    if (!confirmado) {
      statusEl.textContent =
        'Não foi possível confirmar o recebimento neste momento. ' +
        'Não envie novamente. Entre em contato com a equipe Prospera ' +
        'e informe o protocolo: ' + dados.id_registro;

      return;
    }

    el('protocoloConfirmado').textContent =
      dados.id_registro;

    sucesso.classList.add('show');

    statusEl.textContent = '';
    ultimoIdPendente = null;

    form.reset();

    el('uf').value = '';
    el('listaMunicipios').replaceChildren();
    el('listaBairros').replaceChildren();

    alternarDocumento();
    condicaoDetalhes();

    el('data').value = dataHoje();
    el('inicio').value = horarioAgora();
    el('fim').value = '';

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  } catch (e) {
    statusEl.textContent =
      'Não foi possível verificar o envio. ' +
      'Não envie novamente antes de falar com a equipe. ' +
      'Protocolo: ' + dados.id_registro;

  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar Formulário';
  }
});

for (
  const r of form.querySelectorAll(
    'input[name="tipo_documento"]'
  )
) {
  r.addEventListener('change', alternarDocumento);
}

for (const id of ['dificuldade', 'curso']) {
  el(id).addEventListener('change', condicaoDetalhes);
}

el('projeto').addEventListener(
  'change', carregarMunicipios
);

formatarCampos();
alternarDocumento();
condicaoDetalhes();

el('data').value = dataHoje();
el('inicio').value = horarioAgora();
