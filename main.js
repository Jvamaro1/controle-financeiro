// A V I S O: Substitua os valores abaixo com as suas credenciais do Firebase!
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_AUTH_DOMAIN",
    databaseURL: "SUA_DATABASE_URL",
    projectId: "SEU_PROJECT_ID",
    storageBucket: "SEU_STORAGE_BUCKET",
    messagingSenderId: "SEU_MESSAGING_SENDER_ID",
    appId: "SEU_APP_ID",
    measurementId: "SEU_MEASUREMENT_ID"
};

// Importa as funções do Firebase que você precisa
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getDatabase, ref, set, onValue, remove, push, update } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Variáveis de escopo global
let totalReceitas = 0;
let totalDespesas = 0;
let receitas = [];
let despesas = [];
let investimentos = [];
let metas = [];
let dashboardChartInstance = null;
let relatoriosChartInstance = null;
let currentUserId = null;
let isPremium = false; // Flag para o plano premium

// Chaves para o Firebase
const KEY_RECEITAS = 'receitas';
const KEY_DESPESAS = 'despesas';
const KEY_INVESTIMENTOS = 'investimentos';
const KEY_METAS = 'metas';
const KEY_USERS = 'users';

// Funções utilitárias
function formatarValor(valor) {
    return `R$ ${parseFloat(valor).toFixed(2).replace('.', ',')}`;
}

function getCaminhoMesAno() {
    const mes = document.getElementById('mes').value;
    const ano = document.getElementById('ano').value;
    return `${ano}/${mes}`;
}

function carregarDados() {
    if (!currentUserId) return;

    // Caminho dinâmico para o mês e ano selecionados
    const caminhoMesAno = getCaminhoMesAno();

    // Carrega dados do usuário (premium, nome, etc)
    const userRef = ref(database, `${KEY_USERS}/${currentUserId}`);
    onValue(userRef, (snapshot) => {
        const userData = snapshot.val();
        if (userData) {
            document.querySelector('.user-profile h3').textContent = userData.name || 'Usuário';
            isPremium = userData.isPremium || false;
            // Lógica para features premium pode ser adicionada aqui
        }
    });

    // Carrega os dados de receitas do mês/ano
    const receitasRef = ref(database, `${KEY_RECEITAS}/${currentUserId}/${caminhoMesAno}`);
    onValue(receitasRef, (snapshot) => {
        receitas = [];
        snapshot.forEach(childSnapshot => {
            receitas.push({ ...childSnapshot.val(), id: childSnapshot.key });
        });
        totalReceitas = receitas.reduce((sum, item) => sum + item.valor, 0);
        atualizarResumo();
        renderizarListaMovimentacoes();
        renderizarGraficoDashboard();
    });

    // Carrega os dados de despesas do mês/ano
    const despesasRef = ref(database, `${KEY_DESPESAS}/${currentUserId}/${caminhoMesAno}`);
    onValue(despesasRef, (snapshot) => {
        despesas = [];
        snapshot.forEach(childSnapshot => {
            despesas.push({ ...childSnapshot.val(), id: childSnapshot.key });
        });
        totalDespesas = despesas.reduce((sum, item) => sum + item.valor, 0);
        atualizarResumo();
        renderizarListaMovimentacoes();
        renderizarListaDespesas();
        renderizarGraficoDashboard();
        renderizarGraficoRelatorios();
    });

    // Carrega os dados globais (investimentos e metas)
    const investimentosRef = ref(database, `${KEY_INVESTIMENTOS}/${currentUserId}`);
    onValue(investimentosRef, (snapshot) => {
        investimentos = [];
        snapshot.forEach(childSnapshot => {
            investimentos.push({ ...childSnapshot.val(), id: childSnapshot.key });
        });
        renderizarListaInvestimentos();
    });

    const metasRef = ref(database, `${KEY_METAS}/${currentUserId}`);
    onValue(metasRef, (snapshot) => {
        metas = [];
        snapshot.forEach(childSnapshot => {
            metas.push({ ...childSnapshot.val(), id: childSnapshot.key });
        });
        renderizarListaMetas();
    });
}

function limparDados() {
    const confirma = confirm("Tem certeza que deseja apagar todas as movimentações (receitas e despesas) deste mês?");
    if (confirma && currentUserId) {
        const caminhoMesAno = getCaminhoMesAno();
        remove(ref(database, `${KEY_RECEITAS}/${currentUserId}/${caminhoMesAno}`));
        remove(ref(database, `${KEY_DESPESAS}/${currentUserId}/${caminhoMesAno}`));
    }
}

function initApp() {
    const hoje = new Date();
    document.getElementById('mes').value = hoje.getMonth() + 1;
    document.getElementById('ano').value = hoje.getFullYear();

    const hora = hoje.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });
    let saudacao;
    if (hoje.getHours() < 12) {
        saudacao = "Bom dia!";
    } else if (hoje.getHours() < 18) {
        saudacao = "Boa tarde!";
    } else {
        saudacao = "Boa noite!";
    }
    document.getElementById('horaAtual').textContent = `${hora} ${saudacao}`;

    // Observa o estado de autenticação
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUserId = user.uid;
            document.querySelector('.app-container').style.display = 'flex';
            document.getElementById('auth-container').style.display = 'none';
            carregarDados();
            atualizarHeaderMes();
        } else {
            currentUserId = null;
            document.querySelector('.app-container').style.display = 'none';
            document.getElementById('auth-container').style.display = 'flex';
            // Limpa os dados na interface
            receitas = [];
            despesas = [];
            investimentos = [];
            metas = [];
            atualizarResumo();
            renderizarListaMovimentacoes();
            renderizarListaDespesas();
            renderizarListaInvestimentos();
            renderizarListaMetas();
        }
    });

    // Adiciona event listeners para os botões do formulário
    document.getElementById('transacaoTipo').addEventListener('change', alternarCampos);
    document.querySelector('.form-add-btn[onclick="adicionarTransacao()"]').addEventListener('click', adicionarTransacao);
    document.querySelector('.form-add-btn[onclick="limparDados()"]').addEventListener('click', limparDados);

    // Event listeners para os menus laterais
    document.getElementById('menu-dashboard').addEventListener('click', () => mostrarConteudo('dashboard'));
    document.getElementById('menu-relatorios').addEventListener('click', () => mostrarConteudo('relatorios'));
    document.getElementById('menu-despesas').addEventListener('click', () => mostrarConteudo('despesas'));
    document.getElementById('menu-investimentos').addEventListener('click', () => mostrarConteudo('investimentos'));
    document.getElementById('menu-metas').addEventListener('click', () => mostrarConteudo('metas'));
    document.getElementById('menu-cartoes').addEventListener('click', () => mostrarConteudo('cartoes'));

    // Event listeners para os botões de adicionar
    document.querySelector('.investimentos-section .form-add-btn').addEventListener('click', adicionarInvestimento);
    document.querySelector('.metas-section .form-add-btn').addEventListener('click', adicionarMeta);
    
    // Configura os botões de login/cadastro
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('signup-btn').addEventListener('click', handleSignup);
    document.querySelector('.logout-btn').addEventListener('click', handleLogout);

    mostrarConteudo('dashboard');
    alternarCampos();
}

// Funções de Autenticação
function handleLogin() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');

    signInWithEmailAndPassword(auth, email, password)
        .then(() => {
            errorEl.textContent = '';
        })
        .catch((error) => {
            let errorMessage = "Erro ao fazer login. Verifique seu email e senha.";
            if (error.code === 'auth/wrong-password') {
                errorMessage = "Senha incorreta.";
            } else if (error.code === 'auth/user-not-found') {
                errorMessage = "Usuário não encontrado.";
            }
            errorEl.textContent = errorMessage;
        });
}

function handleSignup() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');

    if (password.length < 6) {
        errorEl.textContent = "A senha deve ter pelo menos 6 caracteres.";
        return;
    }

    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            set(ref(database, `${KEY_USERS}/${user.uid}`), {
                email: email,
                isPremium: false,
                name: 'Novo Usuário'
            });
            errorEl.textContent = '';
        })
        .catch((error) => {
            let errorMessage = "Erro ao criar conta.";
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "Este email já está em uso.";
            }
            errorEl.textContent = errorMessage;
        });
}

function handleLogout() {
    signOut(auth)
        .then(() => {
            console.log("Usuário deslogado com sucesso!");
        })
        .catch((error) => {
            console.error("Erro ao deslogar:", error);
        });
}

function atualizarHeaderMes() {
    const mes = document.getElementById('mes').value;
    const nomeMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const nomeMesAtual = nomeMeses[mes - 1];
    document.getElementById('mesAtual').textContent = nomeMesAtual;
}

function atualizarResumo() {
    const saldoFinal = totalReceitas - totalDespesas;
    document.getElementById('totalReceitas').textContent = formatarValor(totalReceitas);
    document.getElementById('totalDespesas').textContent = formatarValor(totalDespesas);
    document.getElementById('saldoMes').textContent = formatarValor(saldoFinal);
}

function adicionarTransacao() {
    if (!currentUserId) {
        alert("Por favor, faça login para adicionar transações.");
        return;
    }
    const desc = document.getElementById('transacaoDesc').value;
    const valorInput = document.getElementById('transacaoValor');
    const valor = parseFloat(valorInput.value);
    const tipo = document.getElementById('transacaoTipo').value;
    const categoria = document.getElementById('transacaoCategoria').value;
    const meioPagamento = document.getElementById('tipoPagamento').value;
    const caminhoMesAno = getCaminhoMesAno();

    if (desc && !isNaN(valor) && valor > 0) {
        const transacao = {
            descricao: desc,
            valor: valor,
            tipo: tipo,
            categoria: categoria,
            meioPagamento: meioPagamento,
            data: new Date().toLocaleDateString('pt-BR')
        };
        
        const dbRef = push(ref(database, `${tipo === 'receita' ? KEY_RECEITAS : KEY_DESPESAS}/${currentUserId}/${caminhoMesAno}`));
        set(dbRef, transacao);

        document.getElementById('transacaoDesc').value = '';
        document.getElementById('transacaoValor').value = '';
        document.getElementById('transacaoTipo').value = 'receita';
        alternarCampos();
    } else {
        alert("Por favor, preencha a descrição e um valor válido.");
    }
}

function removerTransacaoPorId(id, tipo) {
    if (!currentUserId) return;
    let confirma = confirm("Tem certeza que deseja apagar esta movimentação?");
    if (!confirma) return;

    const caminhoMesAno = getCaminhoMesAno();
    remove(ref(database, `${tipo === 'receita' ? KEY_RECEITAS : KEY_DESPESAS}/${currentUserId}/${caminhoMesAno}/${id}`));
}

function renderizarListaMovimentacoes() {
    const listaTbody = document.getElementById('listaMovimentacoes');
    listaTbody.innerHTML = '';

    const todasTransacoes = [...receitas, ...despesas];
    todasTransacoes.sort((a, b) => {
        const [dA, mA, aA] = a.data.split('/').map(Number);
        const [dB, mB, aB] = b.data.split('/').map(Number);
        const dataA = new Date(aA, mA - 1, dA);
        const dataB = new Date(aB, mB - 1, dB);
        return dataB - dataA;
    });

    todasTransacoes.forEach(item => {
        const tr = document.createElement('tr');
        const valorCor = item.tipo === 'receita' ? '#2ecc71' : '#e74c3c';
        const tipoTexto = item.tipo === 'receita' ? 'Entrada' : 'Saída';

        tr.innerHTML = `
            <td>${item.descricao}</td>
            <td style="color:${valorCor};">${formatarValor(item.valor)}</td>
            <td>${item.data}</td>
            <td>${tipoTexto}</td>
            <td>${item.categoria}</td>
            <td>
                <div class="action-btns">
                    <button onclick="removerTransacaoPorId('${item.id}', '${item.tipo}')">🗑️</button>
                </div>
            </td>
        `;
        listaTbody.appendChild(tr);
    });
}

function renderizarListaDespesas() {
    const listaTbody = document.getElementById('listaDespesas');
    listaTbody.innerHTML = '';

    const despesasOrdenadas = [...despesas].sort((a, b) => {
        const [dA, mA, aA] = a.data.split('/').map(Number);
        const [dB, mB, aB] = b.data.split('/').map(Number);
        const dataA = new Date(aA, mA - 1, dA);
        const dataB = new Date(aB, mB - 1, dB);
        return dataB - dataA;
    });

    despesasOrdenadas.forEach(item => {
        const tr = document.createElement('tr');
        const valorCor = '#e74c3c';

        tr.innerHTML = `
            <td>${item.descricao}</td>
            <td style="color:${valorCor};">${formatarValor(item.valor)}</td>
            <td>${item.data}</td>
            <td>${item.categoria}</td>
            <td>
                <div class="action-btns">
                    <button onclick="removerTransacaoPorId('${item.id}', 'despesa')">🗑️</button>
                </div>
            </td>
        `;
        listaTbody.appendChild(tr);
    });
}

function adicionarInvestimento() {
    if (!currentUserId) {
        alert("Por favor, faça login para adicionar investimentos.");
        return;
    }
    const desc = document.getElementById('investimentoDesc').value;
    const valor = parseFloat(document.getElementById('investimentoValor').value);

    if (desc && !isNaN(valor) && valor > 0) {
        const investimento = {
            descricao: desc,
            valor: valor,
            data: new Date().toLocaleDateString('pt-BR')
        };
        const dbRef = push(ref(database, `${KEY_INVESTIMENTOS}/${currentUserId}`));
        set(dbRef, investimento);
        document.getElementById('investimentoDesc').value = '';
        document.getElementById('investimentoValor').value = '';
    } else {
        alert("Por favor, preencha a descrição e um valor válido.");
    }
}

function renderizarListaInvestimentos() {
    const listaTbody = document.getElementById('listaInvestimentos');
    listaTbody.innerHTML = '';

    const investimentosOrdenados = [...investimentos].sort((a, b) => {
        const [dA, mA, aA] = a.data.split('/').map(Number);
        const [dB, mB, aB] = b.data.split('/').map(Number);
        const dataA = new Date(aA, mA - 1, dA);
        const dataB = new Date(aB, mB - 1, dB);
        return dataB - dataA;
    });

    investimentosOrdenados.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.descricao}</td>
            <td>${formatarValor(item.valor)}</td>
            <td>${item.data}</td>
            <td>
                <button onclick="removerInvestimentoPorId('${item.id}')">🗑️</button>
            </td>
        `;
        listaTbody.appendChild(tr);
    });
}

function removerInvestimentoPorId(id) {
    if (!currentUserId) return;
    let confirma = confirm("Tem certeza que deseja apagar este investimento?");
    if (!confirma) return;

    remove(ref(database, `${KEY_INVESTIMENTOS}/${currentUserId}/${id}`));
}

function adicionarMeta() {
    if (!currentUserId) {
        alert("Por favor, faça login para adicionar metas.");
        return;
    }
    const desc = document.getElementById('metaDesc').value;
    const alvo = parseFloat(document.getElementById('metaAlvo').value);
    const atual = parseFloat(document.getElementById('metaAtual').value);

    if (desc && !isNaN(alvo) && alvo > 0 && !isNaN(atual) && atual >= 0) {
        const meta = {
            descricao: desc,
            alvo: alvo,
            atual: atual,
            progresso: (atual / alvo) * 100
        };
        const dbRef = push(ref(database, `${KEY_METAS}/${currentUserId}`));
        set(dbRef, meta);
        document.getElementById('metaDesc').value = '';
        document.getElementById('metaAlvo').value = '';
        document.getElementById('metaAtual').value = '';
    } else {
        alert("Por favor, preencha todos os campos com valores válidos.");
    }
}

function renderizarListaMetas() {
    const listaDiv = document.getElementById('listaMetas');
    listaDiv.innerHTML = '';

    metas.forEach(item => {
        const progress = item.progresso > 100 ? 100 : item.progresso;
        const metaDiv = document.createElement('div');
        metaDiv.classList.add('metas-section');
        metaDiv.innerHTML = `
            <h3>${item.descricao}</h3>
            <p>Valor atual: <strong>${formatarValor(item.atual)}</strong> de <strong>${formatarValor(item.alvo)}</strong></p>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${progress.toFixed(2)}%;">
                    ${progress.toFixed(0)}%
                </div>
            </div>
            <button class="form-add-btn" style="background: #e74c3c; box-shadow: none; margin-top: 15px;" onclick="removerMetaPorId('${item.id}')">Excluir Meta</button>
        `;
        listaDiv.appendChild(metaDiv);
    });
}

function removerMetaPorId(id) {
    if (!currentUserId) return;
    let confirma = confirm("Tem certeza que deseja apagar esta meta?");
    if (!confirma) return;

    remove(ref(database, `${KEY_METAS}/${currentUserId}/${id}`));
}

function mostrarConteudo(id) {
    const conteudos = document.querySelectorAll('.main-content');
    conteudos.forEach(c => c.classList.remove('active'));

    const menus = document.querySelectorAll('.nav-menu li');
    menus.forEach(m => m.classList.remove('active'));

    document.getElementById(`content-${id}`).classList.add('active');
    document.getElementById(`menu-${id}`).classList.add('active');

    if (id === 'relatorios') {
        renderizarGraficoRelatorios();
    } else if (id === 'despesas') {
        renderizarListaDespesas();
    } else if (id === 'investimentos') {
        renderizarListaInvestimentos();
    } else if (id === 'metas') {
        renderizarListaMetas();
    }
}

function alternarCampos() {
    const tipo = document.getElementById('transacaoTipo').value;
    const categoriaSelect = document.getElementById('transacaoCategoria');
    const campoTipoPagamento = document.getElementById('campoTipoPagamento');

    categoriaSelect.innerHTML = '';

    if (tipo === 'receita') {
        const categoriasReceita = ['Salário', 'Venda', 'Freelance', 'Outros'];
        categoriasReceita.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.toLowerCase();
            option.textContent = cat;
            categoriaSelect.appendChild(option);
        });
        campoTipoPagamento.style.display = 'none';
    } else {
        const categoriasDespesa = ['Alimentação', 'Moradia', 'Transporte', 'Educação', 'Saúde', 'Lazer', 'Contas', 'Compras', 'Outros'];
        categoriasDespesa.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.toLowerCase();
            option.textContent = cat;
            categoriaSelect.appendChild(option);
        });
        campoTipoPagamento.style.display = 'flex';
    }
}

function renderizarGraficoDashboard() {
    const ctx = document.getElementById('receitasDespesasChart').getContext('2d');

    if (dashboardChartInstance) {
        dashboardChartInstance.destroy();
    }

    dashboardChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Receita', 'Despesa'],
            datasets: [{
                data: [totalReceitas, totalDespesas],
                backgroundColor: ['#2ecc71', '#e74c3c'],
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            return `${label}: ${formatarValor(value)}`;
                        }
                    }
                }
            }
        }
    });
}

function renderizarGraficoRelatorios() {
    const ctx = document.getElementById('despesasPorCategoriaChart').getContext('2d');

    if (relatoriosChartInstance) {
        relatoriosChartInstance.destroy();
    }

    const despesasPorCategoria = {};
    despesas.forEach(d => {
        if (despesasPorCategoria[d.categoria]) {
            despesasPorCategoria[d.categoria] += d.valor;
        } else {
            despesasPorCategoria[d.categoria] = d.valor;
        }
    });

    const labels = Object.keys(despesasPorCategoria);
    const data = Object.values(despesasPorCategoria);
    const backgroundColors = labels.map((_, index) => `hsl(${index * 45}, 70%, 60%)`); // Cores dinâmicas
    const borderColors = labels.map((_, index) => `hsl(${index * 45}, 80%, 50%)`);

    relatoriosChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Gasto',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Valor (R$)' }
                },
                x: {
                    title: { display: true, text: 'Categoria' }
                }
            },
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Despesas por Categoria para o Mês Atual',
                    font: { size: 16 },
                    color: '#333'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatarValor(context.parsed.y)}`;
                        }
                    }
                }
            }
        }
    });
}

// Inicia o aplicativo quando a página é carregada
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});
