async function paginaClientes() {
    try {
        const [respClientes, respRegioes] = await Promise.all([
            Conecta.request('clientes.php'),
            Conecta.request('regioes.php'),
        ]);

        // Validação de segurança
        const clientes = Array.isArray(respClientes) ? respClientes : (Array.isArray(respClientes?.dados) ? respClientes.dados : []);
        const regioes = Array.isArray(respRegioes) ? respRegioes : (Array.isArray(respRegioes?.dados) ? respRegioes.dados : []);

        // 6 Planos de exemplo simulando vários provedores/fornecedores
        const planosExemplo = [
            { id: 1, provedor: 'Conecta Local', nome: '100 Mega', preco: 49.90 },
            { id: 2, provedor: 'FibraNet', nome: '250 Mega', preco: 69.90 },
            { id: 3, provedor: 'Ultra Fast', nome: '400 Mega', preco: 89.90 },
            { id: 4, provedor: 'GigaTelecom', nome: '600 Mega', preco: 109.90 },
            { id: 5, provedor: 'FibraNet', nome: '800 Mega', preco: 139.90 },
            { id: 6, provedor: 'StarWeb', nome: '1 Giga', preco: 189.90 }
        ];

        document.getElementById('pageRoot').innerHTML = `
            <section class="panel">
                <div class="panel-header"><h2 class="panel-title">Cadastrar cliente</h2></div>
                <form id="formCliente" class="toolbar">
                    <div class="field"><label>Nome</label><input id="nome" required></div>
                    <div class="field"><label>E-mail</label><input id="email" type="email" required></div>
                    <div class="field"><label>Senha</label><input id="senha" type="password" required></div>
                    <div class="field"><label>CEP</label><input id="cep" maxlength="8" required></div>
                    <div class="field"><label>Área</label>
                        <select id="id_regiao">
                            <option value="">—</option>
                            ${regioes.map((r) => `<option value="${r.id_regiao}">${r.nome}</option>`).join('')}
                        </select>
                    </div>
                    
                    <!-- Novos campos de Renda e Planos Dinâmicos -->
                    <div class="field">
                        <label>Renda Familiar (R$)</label>
                        <input id="renda" type="number" min="0" step="0.01" required placeholder="Ex: 2500.00">
                    </div>
                    <div class="field">
                        <label>Plano (Máx 5% da Renda)</label>
                        <select id="id_plano" required disabled>
                            <option value="">Informe a renda primeiro...</option>
                        </select>
                    </div>

                    <input type="hidden" id="latitude">
                    <input type="hidden" id="longitude">
                    <button class="btn" type="submit" style="align-self: flex-end;">Salvar</button>
                </form>
                <p id="mensagem-cep" class="hint"></p>
            </section>
            
            <section class="panel">
                <div class="table-responsive">
                    <table>
                        <thead><tr><th>Nome</th><th>E-mail</th><th>Plano</th><th>Área</th><th>CEP</th></tr></thead>
                        <tbody>
                            ${clientes.length > 0 ? clientes.map((c) => `
                                <tr>
                                    <td>${c.nome}</td><td>${c.email}</td><td>${c.plano || '—'}</td><td>${c.regiao || '—'}</td><td>${c.cep || '—'}</td>
                                </tr>`).join('') : '<tr><td colspan="5" class="empty-state">Nenhum cliente.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </section>`;

        // Lógica de cálculo dos 5% da renda e filtro de planos
        document.getElementById('renda').addEventListener('input', (e) => {
            const renda = parseFloat(e.target.value) || 0;
            const maxPermitido = renda * 0.05; // Regra: mensalidade não pode ultrapassar 5% da renda
            const selectPlano = document.getElementById('id_plano');
            
            if (renda <= 0) {
                selectPlano.innerHTML = '<option value="">Informe a renda primeiro...</option>';
                selectPlano.disabled = true;
                return;
            }

            // Filtra os planos em que o preço é menor ou igual aos 5% da renda
            const planosPermitidos = planosExemplo.filter(p => p.preco <= maxPermitido);
            
            if (planosPermitidos.length === 0) {
                selectPlano.innerHTML = `<option value="">Nenhum plano disponível (5% da renda = R$ ${maxPermitido.toFixed(2).replace('.', ',')})</option>`;
                selectPlano.disabled = true;
            } else {
                selectPlano.innerHTML = '<option value="">Selecione o plano ideal...</option>' + 
                    planosPermitidos.map(p => `<option value="${p.id}">${p.provedor} - ${p.nome} (R$ ${p.preco.toFixed(2).replace('.', ',')})</option>`).join('');
                selectPlano.disabled = false;
            }
        });

        document.getElementById('cep').addEventListener('blur', async () => {
            const cep = document.getElementById('cep').value.replace(/\D/g, '');
            const msg = document.getElementById('mensagem-cep');
            if (cep.length !== 8) return;
            try {
                const via = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then((r) => r.json());
                if (via.erro) {
                    msg.textContent = 'CEP não encontrado.';
                    msg.className = 'hint error';
                    return;
                }
                const q = encodeURIComponent(`${via.logradouro}, ${via.localidade}, ${via.uf}`);
                const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}`).then((r) => r.json());
                if (geo[0]) {
                    document.getElementById('latitude').value = geo[0].lat;
                    document.getElementById('longitude').value = geo[0].lon;
                    msg.textContent = 'GPS capturado.';
                    msg.className = 'hint ok';
                }
            } catch {
                msg.textContent = 'Falha ao geocodificar CEP.';
                msg.className = 'hint error';
            }
        });

        document.getElementById('formCliente').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Procura o plano escolhido no array para enviar o nome correto à API, se necessário
            const idPlanoSelecionado = document.getElementById('id_plano').value;
            const planoSelecionado = planosExemplo.find(p => p.id == idPlanoSelecionado);

            try {
                await Conecta.request('cadastrar_usuario.php', {
                    method: 'POST',
                    body: JSON.stringify({
                        nome: document.getElementById('nome').value,
                        email: document.getElementById('email').value,
                        senha: document.getElementById('senha').value,
                        cep: document.getElementById('cep').value,
                        perfil: 'CLIENTE',
                        id_regiao: document.getElementById('id_regiao').value || null,
                        latitude: document.getElementById('latitude').value,
                        longitude: document.getElementById('longitude').value,
                        // Enviamos a renda e os detalhes do plano no pedido POST
                        renda_familiar: document.getElementById('renda').value,
                        id_plano: idPlanoSelecionado,
                        nome_plano: planoSelecionado ? `${planoSelecionado.provedor} - ${planoSelecionado.nome}` : null
                    }),
                });
                Conecta.toast('Cliente cadastrado com sucesso!');
                paginaClientes(); // Recarrega a listagem
            } catch (err) {
                Conecta.toast(err.message, 'erro');
            }
        });
    } catch (error) {
        document.getElementById('pageRoot').innerHTML = `<div class="panel empty-state">Falha ao carregar clientes: ${error.message}</div>`;
    }
}

document.addEventListener('DOMContentLoaded', () => paginaClientes().catch((e) => console.error("Erro fatal:", e.message)));