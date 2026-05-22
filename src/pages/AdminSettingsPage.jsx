import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Settings, Target } from 'lucide-react';
import LeadSourceManager from '@/components/LeadSourceManager';

const AdminSettingsPage = () => {
  return (
    <>
      <Helmet>
        <title>Configurações - Painel de Vendas Megumi Tarot</title>
      </Helmet>

      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-purple-100 rounded-xl">
            <Settings className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configurações de Administrador</h1>
            <p className="text-gray-500 text-sm">Gerencie parâmetros e opções globais do sistema.</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
        >
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-600" />
              Opções de Origem de Lead (Controle de Leads)
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Personalize a lista de origens disponíveis no momento de cadastrar uma nova venda.
            </p>
          </div>
          
          <div className="p-6">
            <LeadSourceManager />
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default AdminSettingsPage;