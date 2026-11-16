import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  buscarAlunosDaAula,
  buscarAulas,
  buscarMinhasAulas,
  buscarUsuario,
  buscarUsuarioPorNome,
  cadastrarUsuario,
  cancelarReserva,
  criarAula,
  editarAula,
  excluirAula,
  inicializarBanco,
  reservarAula,
} from '../database/database';

type Usuario = {
  id: number;
  usuario: string;
  tipo: string;
};

type Aula = {
  id: number;
  dia: string;
  horario: string;
  vagas: number;
  capacidade: number;
};

type Aluno = {
  id: number;
  usuario: string;
};

export default function Index() {
  const [usuarioAtual, setUsuarioAtual] =
    useState<Usuario | null>(null);

  const [tela, setTela] = useState<
    'login' | 'cadastro' | 'aluno' | 'admin'
  >('login');

  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] =
    useState('');

  const [aulas, setAulas] = useState<Aula[]>([]);
  const [minhasAulas, setMinhasAulas] =
    useState<Aula[]>([]);

  const [alunosPorAula, setAlunosPorAula] =
    useState<Record<number, Aluno[]>>({});

  const [dia, setDia] = useState('');
  const [horario, setHorario] = useState('');
  const [quantidadeAlunos, setQuantidadeAlunos] =
    useState('');

  const [aulaEditando, setAulaEditando] =
    useState<number | null>(null);

  useEffect(() => {
    inicializarBanco();
  }, []);

  // ==============================
  // CARREGAR AULAS
  // ==============================

  async function carregarAulas() {
    const resultado = await buscarAulas();

    setAulas(resultado);

    if (usuarioAtual?.tipo === 'admin') {
      await carregarAlunosDeTodasAsAulas(resultado);
    }
  }

  async function carregarAlunosDeTodasAsAulas(
    listaAulas: Aula[]
  ) {
    const novoMapa: Record<number, Aluno[]> = {};

    for (const aula of listaAulas) {
      const alunos =
        await buscarAlunosDaAula(aula.id);

      novoMapa[aula.id] = alunos;
    }

    setAlunosPorAula(novoMapa);
  }

  async function carregarMinhasAulas(
    usuarioId: number
  ) {
    const resultado =
      await buscarMinhasAulas(usuarioId);

    setMinhasAulas(resultado);
  }

  // ==============================
  // NAVEGAÇÃO
  // ==============================

  function voltarParaLogin() {
    setUsuarioAtual(null);
    setUsuario('');
    setSenha('');
    setConfirmarSenha('');
    setAlunosPorAula({});
    limparFormularioAula();
    setTela('login');
  }

  function voltarParaTelaAnterior() {
    if (tela === 'cadastro') {
      setUsuario('');
      setSenha('');
      setConfirmarSenha('');
      setTela('login');
      return;
    }

    voltarParaLogin();
  }

  // ==============================
  // LOGIN
  // ==============================

  async function fazerLogin() {
    if (!usuario.trim() || !senha.trim()) {
      Alert.alert(
        'Atenção',
        'Preencha usuário e senha.'
      );
      return;
    }

    try {
      const usuarioEncontrado =
        await buscarUsuarioPorNome(
          usuario.trim()
        );

      if (!usuarioEncontrado) {
        Alert.alert(
          'Conta não encontrada',
          'Esse usuário não está cadastrado.'
        );
        return;
      }

      const login = await buscarUsuario(
        usuario.trim(),
        senha
      );

      if (!login) {
        Alert.alert(
          'Senha incorreta',
          'A senha informada está incorreta.'
        );
        return;
      }

      const usuarioLogado: Usuario = {
        id: login.id,
        usuario: login.usuario,
        tipo: login.tipo,
      };

      setUsuarioAtual(usuarioLogado);
      setUsuario('');
      setSenha('');

      const aulasAtuais = await buscarAulas();
      setAulas(aulasAtuais);

      if (login.tipo === 'admin') {
        await carregarAlunosDeTodasAsAulas(
          aulasAtuais
        );

        setTela('admin');
      } else {
        await carregarMinhasAulas(login.id);

        setTela('aluno');
      }
    } catch (erro) {
      Alert.alert(
        'Erro',
        'Não foi possível realizar o login.'
      );
    }
  }

  // ==============================
  // CADASTRO
  // ==============================

  async function fazerCadastro() {
    if (!usuario.trim() || !senha.trim()) {
      Alert.alert(
        'Atenção',
        'Preencha usuário e senha.'
      );
      return;
    }

    if (senha !== confirmarSenha) {
      Alert.alert(
        'Atenção',
        'As senhas não são iguais.'
      );
      return;
    }

    if (
      usuario.trim().toLowerCase() ===
      'admin'
    ) {
      Alert.alert(
        'Usuário inválido',
        'Esse nome de usuário não pode ser utilizado.'
      );
      return;
    }

    try {
      await cadastrarUsuario(
        usuario.trim(),
        senha
      );

      Alert.alert(
        'Cadastro realizado',
        'Sua conta foi criada com sucesso.'
      );

      setUsuario('');
      setSenha('');
      setConfirmarSenha('');
      setTela('login');
    } catch (erro) {
      Alert.alert(
        'Erro',
        'Esse usuário já existe.'
      );
    }
  }

  // ==============================
  // RESERVA
  // ==============================

  async function fazerReserva(
    aulaId: number
  ) {
    if (!usuarioAtual) {
      return;
    }

    try {
      await reservarAula(
        usuarioAtual.id,
        aulaId
      );

      const aulasAtualizadas =
        await buscarAulas();

      setAulas(aulasAtualizadas);

      await carregarMinhasAulas(
        usuarioAtual.id
      );

      Alert.alert(
        'Reserva realizada',
        'A aula foi reservada com sucesso.'
      );
    } catch (erro: any) {
      if (
        erro?.message === 'SEM_VAGAS'
      ) {
        Alert.alert(
          'Sem vagas',
          'Essa aula não possui mais vagas.'
        );
      } else if (
        erro?.message ===
        'RESERVA_EXISTENTE'
      ) {
        Alert.alert(
          'Atenção',
          'Você já está inscrito nessa aula.'
        );
      } else {
        Alert.alert(
          'Erro',
          'Não foi possível realizar a reserva.'
        );
      }
    }
  }

  async function fazerCancelamento(
    aulaId: number
  ) {
    if (!usuarioAtual) {
      return;
    }

    try {
      await cancelarReserva(
        usuarioAtual.id,
        aulaId
      );

      const aulasAtualizadas =
        await buscarAulas();

      setAulas(aulasAtualizadas);

      await carregarMinhasAulas(
        usuarioAtual.id
      );

      Alert.alert(
        'Reserva cancelada',
        'Sua reserva foi cancelada.'
      );
    } catch (erro) {
      Alert.alert(
        'Erro',
        'Não foi possível cancelar a reserva.'
      );
    }
  }

  // ==============================
  // ADMIN
  // ==============================

  function limparFormularioAula() {
    setDia('');
    setHorario('');
    setQuantidadeAlunos('');
    setAulaEditando(null);
  }

  async function salvarAula() {
    if (
      !dia.trim() ||
      !horario.trim() ||
      !quantidadeAlunos.trim()
    ) {
      Alert.alert(
        'Atenção',
        'Preencha todos os campos.'
      );
      return;
    }

    const quantidade =
      Number(quantidadeAlunos);

    if (
      !Number.isInteger(quantidade) ||
      quantidade <= 0
    ) {
      Alert.alert(
        'Atenção',
        'A quantidade de alunos deve ser um número inteiro maior que zero.'
      );
      return;
    }

    try {
      if (aulaEditando !== null) {
        await editarAula(
          aulaEditando,
          dia.trim(),
          horario.trim(),
          quantidade
        );

        Alert.alert(
          'Aula atualizada',
          'A aula foi atualizada com sucesso.'
        );
      } else {
        await criarAula(
          dia.trim(),
          horario.trim(),
          quantidade
        );

        Alert.alert(
          'Aula criada',
          'A nova aula foi criada com sucesso.'
        );
      }

      limparFormularioAula();

      const aulasAtualizadas =
        await buscarAulas();

      setAulas(aulasAtualizadas);

      await carregarAlunosDeTodasAsAulas(
        aulasAtualizadas
      );
    } catch (erro: any) {
      if (
        erro?.message ===
        'VAGAS_MENOR_RESERVAS'
      ) {
        Alert.alert(
          'Não foi possível alterar',
          'A quantidade de alunos não pode ser menor que o número de alunos já reservados.'
        );
      } else {
        Alert.alert(
          'Erro',
          'Não foi possível salvar a aula.'
        );
      }
    }
  }

  function iniciarEdicao(aula: Aula) {
    setAulaEditando(aula.id);
    setDia(aula.dia);
    setHorario(aula.horario);
    setQuantidadeAlunos(
      String(aula.capacidade)
    );
  }

  async function removerAula(
    aulaId: number
  ) {
    try {
      await excluirAula(aulaId);

      const aulasAtualizadas =
        await buscarAulas();

      setAulas(aulasAtualizadas);

      await carregarAlunosDeTodasAsAulas(
        aulasAtualizadas
      );

      Alert.alert(
        'Aula excluída',
        'A aula foi excluída com sucesso.'
      );
    } catch (erro: any) {
      if (
        erro?.message ===
        'AULA_COM_RESERVAS'
      ) {
        Alert.alert(
          'Não foi possível excluir',
          'Essa aula possui alunos reservados. Cancele as reservas antes de excluir.'
        );
      } else {
        Alert.alert(
          'Erro',
          'Não foi possível excluir a aula.'
        );
      }
    }
  }

  function confirmarExclusao(
    aulaId: number
  ) {
    Alert.alert(
      'Excluir aula',
      'Tem certeza que deseja excluir essa aula?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () =>
            removerAula(aulaId),
        },
      ]
    );
  }

  function sair() {
    voltarParaLogin();
  }

  // ==============================
  // LOGIN
  // ==============================

  if (tela === 'login') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={
            styles.centerContent
          }
        >
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/logo-ello.png')}
              style={styles.logoImage}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>
              Entrar
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Usuário"
              placeholderTextColor="#999"
              value={usuario}
              onChangeText={setUsuario}
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder="Senha"
              placeholderTextColor="#999"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
            />

            <Pressable
              style={styles.primaryButton}
              onPress={fazerLogin}
            >
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                Entrar
              </Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setUsuario('');
                setSenha('');
                setConfirmarSenha('');
                setTela('cadastro');
              }}
            >
              <Text
                style={
                  styles.secondaryButtonText
                }
              >
                Criar conta
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ==============================
  // CADASTRO
  // ==============================

  if (tela === 'cadastro') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={
            styles.pageContent
          }
        >
          <Pressable
            style={styles.backButton}
            onPress={voltarParaTelaAnterior}
          >
            <Text style={styles.backButtonText}>
              ← Voltar
            </Text>
          </Pressable>

          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/logo-ello.png')}
              style={styles.logoImage}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>
              Cadastro
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Usuário"
              placeholderTextColor="#999"
              value={usuario}
              onChangeText={setUsuario}
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder="Senha"
              placeholderTextColor="#999"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
            />

            <TextInput
              style={styles.input}
              placeholder="Confirmar senha"
              placeholderTextColor="#999"
              value={confirmarSenha}
              onChangeText={
                setConfirmarSenha
              }
              secureTextEntry
            />

            <Pressable
              style={styles.primaryButton}
              onPress={fazerCadastro}
            >
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                Cadastrar
              </Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={voltarParaTelaAnterior}
            >
              <Text
                style={
                  styles.secondaryButtonText
                }
              >
                Voltar para login
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ==============================
  // ALUNO
  // ==============================

  if (tela === 'aluno') {
    const idsReservados = new Set(
      minhasAulas.map(
        (aula) => aula.id
      )
    );

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={
            styles.pageContent
          }
        >
          <Pressable
            style={styles.backButton}
            onPress={voltarParaLogin}
          >
            <Text style={styles.backButtonText}>
              ← Voltar
            </Text>
          </Pressable>

          <View style={styles.header}>
            <View>
              <Text style={styles.logo}>
                Ello BT
              </Text>

              <Text style={styles.welcome}>
                Olá, {usuarioAtual?.usuario}
              </Text>
            </View>

            <Pressable
              style={styles.logoutButton}
              onPress={sair}
            >
              <Text style={styles.logoutText}>
                Sair
              </Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>
            Aulas disponíveis
          </Text>

          {aulas.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Nenhuma aula cadastrada.
              </Text>
            </View>
          ) : (
            aulas.map((aula) => {
              const reservada =
                idsReservados.has(aula.id);

              return (
                <View
                  key={aula.id}
                  style={styles.classCard}
                >
                  <Text style={styles.classDay}>
                    {aula.dia}
                  </Text>

                  <Text style={styles.classTime}>
                    {aula.horario}
                  </Text>

                  <Text
                    style={
                      styles.studentsText
                    }
                  >
                    {aula.vagas}{' '}
                    alunos disponíveis
                  </Text>

                  {reservada ? (
                    <Pressable
                      style={
                        styles.cancelButton
                      }
                      onPress={() =>
                        fazerCancelamento(
                          aula.id
                        )
                      }
                    >
                      <Text
                        style={
                          styles.cancelButtonText
                        }
                      >
                        Cancelar reserva
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[
                        styles.primaryButton,
                        aula.vagas <= 0 &&
                          styles.disabledButton,
                      ]}
                      disabled={
                        aula.vagas <= 0
                      }
                      onPress={() =>
                        fazerReserva(
                          aula.id
                        )
                      }
                    >
                      <Text
                        style={
                          styles.primaryButtonText
                        }
                      >
                        {aula.vagas > 0
                          ? 'Reservar aula'
                          : 'Sem vagas'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })
          )}

          <Text style={styles.sectionTitle}>
            Minhas reservas
          </Text>

          {minhasAulas.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Você ainda não possui
                reservas.
              </Text>
            </View>
          ) : (
            minhasAulas.map((aula) => (
              <View
                key={aula.id}
                style={styles.myReservation}
              >
                <View>
                  <Text
                    style={styles.classDay}
                  >
                    {aula.dia}
                  </Text>

                  <Text
                    style={styles.classTime}
                  >
                    {aula.horario}
                  </Text>
                </View>

                <Text
                  style={styles.reservedText}
                >
                  Reservada
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ==============================
  // ADMIN
  // ==============================

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={
          styles.pageContent
        }
      >
        <Pressable
          style={styles.backButton}
          onPress={voltarParaLogin}
        >
          <Text style={styles.backButtonText}>
            ← Voltar
          </Text>
        </Pressable>

        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>
              Ello BT
            </Text>

            <Text style={styles.welcome}>
              Painel administrativo
            </Text>
          </View>

          <Pressable
            style={styles.logoutButton}
            onPress={sair}
          >
            <Text style={styles.logoutText}>
              Sair
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>
            {aulaEditando !== null
              ? 'Editar aula'
              : 'Nova aula'}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Dia da semana"
            placeholderTextColor="#999"
            value={dia}
            onChangeText={setDia}
          />

          <TextInput
            style={styles.input}
            placeholder="Horário"
            placeholderTextColor="#999"
            value={horario}
            onChangeText={setHorario}
          />

          <TextInput
            style={styles.input}
            placeholder="Quantidade máxima de alunos"
            placeholderTextColor="#999"
            value={quantidadeAlunos}
            onChangeText={
              setQuantidadeAlunos
            }
            keyboardType="numeric"
          />

          <Pressable
            style={styles.primaryButton}
            onPress={salvarAula}
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              {aulaEditando !== null
                ? 'Salvar alterações'
                : 'Criar aula'}
            </Text>
          </Pressable>

          {aulaEditando !== null && (
            <Pressable
              style={styles.secondaryButton}
              onPress={limparFormularioAula}
            >
              <Text
                style={
                  styles.secondaryButtonText
                }
              >
                Cancelar edição
              </Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.sectionTitle}>
          Aulas cadastradas
        </Text>

        {aulas.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Nenhuma aula cadastrada.
            </Text>
          </View>
        ) : (
          aulas.map((aula) => {
            const alunos =
              alunosPorAula[aula.id] ?? [];

            return (
              <View
                key={aula.id}
                style={styles.classCard}
              >
                <Text style={styles.classDay}>
                  {aula.dia}
                </Text>

                <Text style={styles.classTime}>
                  {aula.horario}
                </Text>

                <Text
                  style={
                    styles.studentsText
                  }
                >
                  {aula.vagas}{' '}
                  alunos disponíveis
                </Text>

                <View
                  style={
                    styles.studentsContainer
                  }
                >
                  <Text
                    style={
                      styles.studentsTitle
                    }
                  >
                    Alunos inscritos
                  </Text>

                  {alunos.length === 0 ? (
                    <Text
                      style={
                        styles.noStudentsText
                      }
                    >
                      Nenhum aluno reservado
                    </Text>
                  ) : (
                    alunos.map(
                      (aluno, index) => (
                        <View
                          key={aluno.id}
                          style={
                            styles.studentRow
                          }
                        >
                          <Text
                            style={
                              styles.studentNumber
                            }
                          >
                            {index + 1}.
                          </Text>

                          <Text
                            style={
                              styles.studentName
                            }
                          >
                            {aluno.usuario}
                          </Text>
                        </View>
                      )
                    )
                  )}
                </View>

                <View
                  style={styles.adminButtons}
                >
                  <Pressable
                    style={
                      styles.editButton
                    }
                    onPress={() =>
                      iniciarEdicao(aula)
                    }
                  >
                    <Text
                      style={styles.editText}
                    >
                      Editar
                    </Text>
                  </Pressable>

                  <Pressable
                    style={
                      styles.deleteButton
                    }
                    onPress={() =>
                      confirmarExclusao(
                        aula.id
                      )
                    }
                  >
                    <Text
                      style={
                        styles.deleteText
                      }
                    >
                      Excluir
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ==============================
// ESTILOS
// ==============================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F5FF',
  },

  centerContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  pageContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // ==============================
  // VOLTAR
  // ==============================

  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 15,
  },

  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7C5CFC',
  },

  // ==============================
  // LOGO
  // ==============================

  logoContainer: {
    alignItems: 'center',
    marginBottom: 25,
  },

  logoImage: {
    width: 170,
    height: 170,
    borderRadius: 85,
    resizeMode: 'cover',
  },

  logo: {
    fontSize: 32,
    fontWeight: '800',
    color: '#7C5CFC',
  },

  subtitle: {
    fontSize: 16,
    color: '#777',
    marginTop: 4,
  },

  // ==============================
  // CARD
  // ==============================

  card: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#222',
    marginBottom: 20,
  },

  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
    color: '#222',
  },

  // ==============================
  // BOTÕES
  // ==============================

  primaryButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#7C5CFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
    marginTop: 5,
  },

  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },

  secondaryButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7C5CFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
    marginTop: 10,
  },

  secondaryButtonText: {
    color: '#7C5CFC',
    fontSize: 16,
    fontWeight: '700',
  },

  disabledButton: {
    opacity: 0.5,
  },

  // ==============================
  // HEADER
  // ==============================

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },

  welcome: {
    fontSize: 15,
    color: '#777',
    marginTop: 3,
  },

  logoutButton: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
  },

  logoutText: {
    color: '#7C5CFC',
    fontWeight: '700',
  },

  // ==============================
  // SEÇÕES
  // ==============================

  sectionTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#222',
    marginTop: 10,
    marginBottom: 12,
  },

  // ==============================
  // AULAS
  // ==============================

  classCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  classDay: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },

  classTime: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },

  studentsText: {
    fontSize: 15,
    color: '#7C5CFC',
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 12,
  },

  // ==============================
  // ALUNOS
  // ==============================

  studentsContainer: {
    backgroundColor: '#F7F5FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },

  studentsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
  },

  noStudentsText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },

  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },

  studentNumber: {
    width: 25,
    fontSize: 14,
    color: '#777',
    fontWeight: '600',
  },

  studentName: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },

  // ==============================
  // CANCELAR
  // ==============================

  cancelButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButtonText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 15,
  },

  // ==============================
  // VAZIO
  // ==============================

  emptyCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
  },

  emptyText: {
    color: '#777',
    fontSize: 15,
  },

  // ==============================
  // MINHAS RESERVAS
  // ==============================

  myReservation: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  reservedText: {
    color: '#16A34A',
    fontWeight: '700',
  },

  // ==============================
  // ADMIN
  // ==============================

  adminButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
  },

  editButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },

  editText: {
    color: '#7C5CFC',
    fontWeight: '700',
  },

  deleteButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteText: {
    color: '#DC2626',
    fontWeight: '700',
  },
});