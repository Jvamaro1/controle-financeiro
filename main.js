// Variáveis de escopo global
let totalReceitas = 0;
let totalDespesas = 0;
let receitas = [];
let despesas = [];
let investimentos = [];
let metas = [];
let dashboardChartInstance = null;
let relatoriosChartInstance = null;

// Chaves para o Firebase
const KEY_RECEITAS = 'receitas';
const KEY_DESPESAS = 'despesas';
const KEY_INVESTIMENTOS = 'investimentos';
const KEY_METAS = 'metas';

// Acessa o objeto de banco de dados global definido no index.html
const database = firebase.database();

function formatarValor(valor) {
    return `R$ ${parseFloat(valor).toFixed(2).replace('.', ',')}`;
}

function getKey(base) {
    const mes = document.getElementById('mes').value;
    const ano = document.getElementById('ano').value;
    if (base === KEY_INVESTIMENTOS || base === KEY_METAS) {
        return base;
    }
    return `${base}_${mes}_${ano}`;
}

function salvarDados() {
    // A função de salvar é chamada internamente. Não salva tudo de uma vez.
}

function carregarDados() {
    // Carrega os dados específicos do mês/ano (receitas e despesas)
    const receitasRef = database.ref(getKey(KEY_RECEITAS));
    receitasRef.on('value', (snapshot) => {
        receitas = snapshot.val() ? Object.values(snapshot.val()) : [];
        totalReceitas = receitas.reduce((sum, item) => sum + item.valor, 0);
        
        // Atualiza a interface após carregar as receitas
        atualizarResumo();
        renderizarListaMovimentacoes();
        renderizarGraficoDashboard();
    });

    const despesasRef = database.ref(getKey(KEY_DESPESAS));
    despesasRef.on('value', (snapshot) => {
        despesas = snapshot.val() ? Object.values(snapshot.val()) : [];
        totalDespesas = despesas.reduce((sum, item) => sum + item.valor, 0);

        // Atualiza a interface após carregar as despesas
        atualizarResumo();
        renderizarListaMovimentacoes();
        renderizarListaDespesas();
        renderizarGraficoDashboard();
        renderizarGraficoRelatorios();
    });

    // Carrega os dados globais (investimentos e metas)
    const investimentosRef = database.ref(KEY_INVESTIMENTOS);
    investimentosRef.on('value', (snapshot) => {
        investimentos = snapshot.val() ? Object.values(snapshot.val()) : [];
        renderizarListaInvestimentos();
    });

    const metasRef = database.ref(KEY_METAS);
    metasRef.on('value', (snapshot) => {
        metas = snapshot.val() ? Object.values(snapshot.val()) : [];
        renderizarListaMetas();
    });
}

function limparDados() {
    const confirma = confirm("Tem certeza que deseja apagar todas as movimentações (receitas e despesas) deste mês?");
    if (confirma) {
        database.ref(getKey(KEY_RECEITAS)).remove();
        database.ref(getKey(KEY_DESPESAS)).remove();
    }
}

function initApp() {
    const hoje = new Date();
    document.getElementById('mes').value = hoje.getMonth() + 1;
    document.getElementById('ano').value = hoje.getFullYear();
    
    const hora = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    let saudacao;
    if (hoje.getHours() < 12) { saudacao = "Bom dia!"; } 
    else if (hoje.getHours() < 18) { saudacao = "Boa tarde!"; }
    else { saudacao = "Boa noite!"; }
    document.getElementById('horaAtual').textContent = `${hora} ${saudacao}`;

    carregarDados();
    mostrarConteudo('dashboard');
    alternarCampos();
    atualizarHeaderMes();
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
    const desc = document.getElementById('transacaoDesc').value;
    const valorInput = document.getElementById('transacaoValor');
    const valor = parseFloat(valorInput.value);
    const tipo = document.getElementById('transacaoTipo').value;
    const categoria = document.getElementById('transacaoCategoria').value;
    const meioPagamento = document.getElementById('tipoPagamento').value;

    if (desc && !isNaN(valor) && valor > 0) {
        const transacao = {
            id: Date.now(), // Usamos o timestamp para um ID único
            descricao: desc,
            valor: valor,
            tipo: tipo,
            categoria: categoria,
            meioPagamento: meioPagamento,
            data: new Date().toLocaleDateString('pt-BR')
        };

        let dbRef;
        if (tipo === 'receita') {
            dbRef = database.ref(getKey(KEY_RECEITAS));
        } else {
            dbRef = database.ref(getKey(KEY_DESPESAS));
        }
        
        // Adiciona a transação no Firebase
        dbRef.push(transacao);

        // Limpa os campos do formulário
        document.getElementById('transacaoDesc').value = '';
        document.getElementById('transacaoValor').value = '';
        document.getElementById('transacaoTipo').value = 'receita';
        alternarCampos();
    } else {
        alert("Por favor, preencha a descrição e um valor válido.");
    }
}

function removerTransacaoPorId(id, tipo) {
    let confirma = confirm("Tem certeza que deseja apagar esta movimentação?");
    if (!confirma) return;

    let dbRef;
    if (tipo === 'receita') {
        dbRef = database.ref(getKey(KEY_RECEITAS));
    } else {
        dbRef = database.ref(getKey(KEY_DESPESAS));
    }

    dbRef.child(id).remove();
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
    const desc = document.getElementById('investimentoDesc').value;
    const valor = parseFloat(document.getElementById('investimentoValor').value);

    if (desc && !isNaN(valor) && valor > 0) {
        const investimento = {
            id: Date.now(),
            descricao: desc,
            valor: valor,
            data: new Date().toLocaleDateString('pt-BR')
        };
        database.ref(KEY_INVESTIMENTOS).push(investimento);
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
    let confirma = confirm("Tem certeza que deseja apagar este investimento?");
    if (!confirma) return;

    database.ref(KEY_INVESTIMENTOS).child(id).remove();
}

function adicionarMeta() {
    const desc = document.getElementById('metaDesc').value;
    const alvo = parseFloat(document.getElementById('metaAlvo').value);
    const atual = parseFloat(document.getElementById('metaAtual').value);

    if (desc && !isNaN(alvo) && alvo > 0 && !isNaN(atual) && atual >= 0) {
        const meta = {
            id: Date.now(),
            descricao: desc,
            alvo: alvo,
            atual: atual,
            progresso: (atual / alvo) * 100
        };
        database.ref(KEY_METAS).push(meta);
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
    let confirma = confirm("Tem certeza que deseja apagar esta meta?");
    if (!confirma) return;

    database.ref(KEY_METAS).child(id).remove();
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
    
    categoriaSelect.innerHTML = '';

    if (tipo === 'receita') {
        const categoriasReceita = ['Salário', 'Venda', 'Freelance', 'Outros'];
        categoriasReceita.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.toLowerCase();
            option.textContent = cat;
            categoriaSelect.appendChild(option);
        });
    } else {
        const categoriasDespesa = ['Alimentação', 'Moradia', 'Transporte', 'Educação', 'Saúde', 'Lazer', 'Contas', 'Compras', 'Outros'];
        categoriasDespesa.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.toLowerCase();
            option.textContent = cat;
            categoriaSelect.appendChild(option);
        });
    }
}

function renderizarGraficoDashboard() {
    const ctx = document.getElementById('receitasDespesasChart').getContext('2d');
    
    if (dashboardChartInstance) {
        dashboardChartInstance.destroy();
    }

    const total = totalReceitas + totalDespesas;
    const percentualReceita = total > 0 ? (totalReceitas / total) * 100 : 0;
    const percentualDespesa = total > 0 ? (totalDespesas / total) * 100 : 0;

    dashboardChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Receita', 'Despesa'],
            datasets: [{
                data: [percentualReceita.toFixed(2), percentualDespesa.toFixed(2)],
                backgroundColor: [
                    '#2ecc71',
                    '#e74c3c'
                ],
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            return `${label}: ${value}%`;
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

    relatoriosChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Gasto',
                data: data,
                backgroundColor: [
                    '#5dade2',
                    '#f7dc6f',
                    '#a569bd',
                    '#58d68d',
                    '#eb984e',
                    '#e74c3c',
                    '#3498db',
                    '#2ecc71',
                    '#85929e'
                ],
                borderColor: [
                    '#3498db',
                    '#f1c40f',
                    '#8e44ad',
                    '#27ae60',
                    '#d35400',
                    '#c0392b',
                    '#2980b9',
                    '#27ae60',
                    '#7f8c8d'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Valor (R$)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Categoria'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Despesas por Categoria para o Mês Atual',
                    font: {
                        size: 16
                    },
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
