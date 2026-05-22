import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { CalendarClock, Clock, Loader2, Save, Users, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const WINDOW_START = '08:00';
const WINDOW_END = '23:30';

// day_of_week segue a convenção do JS (0 = Domingo). Exibido de Segunda a Domingo.
const DAYS = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

const PALETTE = [
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-rose-100 text-rose-700 border-rose-200',
];

const hhmm = (t) => (t ? String(t).slice(0, 5) : '');

const buildDraft = (operatorId, scheduleMap) =>
  DAYS.reduce((acc, day) => {
    const entry = scheduleMap[`${operatorId}_${day.value}`];
    acc[day.value] = entry
      ? { working: true, start: hhmm(entry.start_time), end: hhmm(entry.end_time) }
      : { working: false, start: WINDOW_START, end: WINDOW_END };
    return acc;
  }, {});

const SchedulePage = () => {
  const [operators, setOperators] = useState([]);
  const [scheduleMap, setScheduleMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedOperatorId) setDraft(buildDraft(selectedOperatorId, scheduleMap));
  }, [selectedOperatorId, scheduleMap]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [{ data: profiles, error: pErr }, { data: schedules, error: sErr }] = await Promise.all([
        supabase.from('profiles').select('id, name, email, role').order('name'),
        supabase.from('operator_schedules').select('*'),
      ]);
      if (pErr) throw pErr;
      if (sErr) throw sErr;

      const map = {};
      (schedules || []).forEach((s) => {
        map[`${s.operator_id}_${s.day_of_week}`] = s;
      });

      setOperators(profiles || []);
      setScheduleMap(map);
      if (!selectedOperatorId && profiles && profiles.length > 0) {
        setSelectedOperatorId(profiles[0].id);
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
      toast({ title: 'Erro', description: 'Falha ao carregar a escala.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const operatorColor = (operatorId) => {
    const idx = operators.findIndex((o) => o.id === operatorId);
    return PALETTE[(idx < 0 ? 0 : idx) % PALETTE.length];
  };

  const updateDraftDay = (dayValue, patch) => {
    setDraft((prev) => ({ ...prev, [dayValue]: { ...prev[dayValue], ...patch } }));
  };

  const handleSave = async () => {
    if (!selectedOperatorId) return;

    const toUpsert = [];
    const offDays = [];

    for (const day of DAYS) {
      const d = draft[day.value];
      if (!d || !d.working) {
        offDays.push(day.value);
        continue;
      }
      if (!d.start || !d.end) {
        return toast({ title: 'Horário incompleto', description: `Preencha início e fim de ${day.label}.`, variant: 'destructive' });
      }
      if (d.start >= d.end) {
        return toast({ title: 'Horário inválido', description: `Em ${day.label}, o início deve ser antes do fim.`, variant: 'destructive' });
      }
      if (d.start < WINDOW_START || d.end > WINDOW_END) {
        return toast({ title: 'Fora do atendimento', description: `Em ${day.label}, use horários entre ${WINDOW_START} e ${WINDOW_END}.`, variant: 'destructive' });
      }
      toUpsert.push({
        operator_id: selectedOperatorId,
        day_of_week: day.value,
        start_time: d.start,
        end_time: d.end,
        updated_at: new Date().toISOString(),
      });
    }

    setSaving(true);
    try {
      if (toUpsert.length > 0) {
        const { error } = await supabase
          .from('operator_schedules')
          .upsert(toUpsert, { onConflict: 'operator_id,day_of_week' });
        if (error) throw error;
      }
      if (offDays.length > 0) {
        const { error } = await supabase
          .from('operator_schedules')
          .delete()
          .eq('operator_id', selectedOperatorId)
          .in('day_of_week', offDays);
        if (error) throw error;
      }
      await loadData();
      toast({ title: 'Escala salva', description: 'Horários atualizados com sucesso.' });
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast({ title: 'Erro', description: 'Falha ao salvar a escala.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const operatorName = (id) => operators.find((o) => o.id === id)?.name || 'Operador';
  const selectedOperator = operators.find((o) => o.id === selectedOperatorId);

  // Visão semanal: por dia, lista de operadores escalados ordenados por início.
  const weekOverview = DAYS.map((day) => {
    const shifts = operators
      .map((op) => {
        const entry = scheduleMap[`${op.id}_${day.value}`];
        return entry ? { operatorId: op.id, name: op.name, start: hhmm(entry.start_time), end: hhmm(entry.end_time) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.start.localeCompare(b.start));
    return { ...day, shifts };
  });

  return (
    <>
      <Helmet>
        <title>Escala - Painel de Vendas Megumi Tarot</title>
      </Helmet>

      <div className="space-y-6 pb-12">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-xl">
            <CalendarClock className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Escala Semanal</h1>
            <p className="text-gray-500 text-sm flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Atendimento das {WINDOW_START} às {WINDOW_END} · escala recorrente toda semana
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        ) : operators.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500">
            Nenhum operador cadastrado. Cadastre membros em "Membros" para montar a escala.
          </div>
        ) : (
          <>
            {/* Visão semanal */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" /> Visão da Semana
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
                {weekOverview.map((day) => (
                  <div key={day.value} className="p-4 min-h-[140px]">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">{day.label}</p>
                    {day.shifts.length === 0 ? (
                      <p className="text-xs text-gray-300 italic">Sem operadores</p>
                    ) : (
                      <div className="space-y-2">
                        {day.shifts.map((s) => (
                          <div key={s.operatorId} className={`px-2 py-1.5 rounded-md border text-xs ${operatorColor(s.operatorId)}`}>
                            <p className="font-semibold truncate">{s.name}</p>
                            <p className="opacity-80">{s.start} – {s.end}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Configuração por operador */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="font-semibold text-gray-900">Configurar Escala</h2>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500">Operador:</label>
                  <select
                    value={selectedOperatorId}
                    onChange={(e) => setSelectedOperatorId(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
                  >
                    {operators.map((op) => (
                      <option key={op.id} value={op.id}>{op.name || op.email}</option>
                    ))}
                  </select>
                </div>
              </div>

              <motion.div
                key={selectedOperatorId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 space-y-2"
              >
                <p className="text-sm text-gray-500 mb-3">
                  Defina o horário de <span className="font-medium text-gray-700">{selectedOperator?.name || selectedOperator?.email}</span> em cada dia. Desmarque "Trabalha" para folga.
                </p>

                {DAYS.map((day) => {
                  const d = draft[day.value] || { working: false, start: WINDOW_START, end: WINDOW_END };
                  return (
                    <div
                      key={day.value}
                      className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border ${d.working ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'}`}
                    >
                      <div className="w-full sm:w-40 font-medium text-gray-800 text-sm">{day.label}</div>

                      <label className="flex items-center gap-2 cursor-pointer select-none sm:w-32">
                        <input
                          type="checkbox"
                          checked={d.working}
                          onChange={(e) => updateDraftDay(day.value, { working: e.target.checked })}
                          className="w-4 h-4 accent-purple-600"
                        />
                        <span className="text-sm text-gray-600">Trabalha</span>
                      </label>

                      {d.working ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            min={WINDOW_START}
                            max={WINDOW_END}
                            value={d.start}
                            onChange={(e) => updateDraftDay(day.value, { start: e.target.value })}
                            className="px-3 py-1.5 rounded-md border border-gray-200 text-sm focus:border-purple-500 outline-none"
                          />
                          <span className="text-gray-400 text-sm">até</span>
                          <input
                            type="time"
                            min={WINDOW_START}
                            max={WINDOW_END}
                            value={d.end}
                            onChange={(e) => updateDraftDay(day.value, { end: e.target.value })}
                            className="px-3 py-1.5 rounded-md border border-gray-200 text-sm focus:border-purple-500 outline-none"
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 flex items-center gap-1.5"><Moon className="w-3.5 h-3.5" /> Folga</span>
                      )}
                    </div>
                  );
                })}

                <div className="pt-4 flex justify-end">
                  <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar Escala de {operatorName(selectedOperatorId)}
                  </Button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default SchedulePage;
