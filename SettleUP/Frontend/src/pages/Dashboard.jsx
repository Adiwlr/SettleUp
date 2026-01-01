import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FaUsers, 
  FaMoneyCheckAlt, 
  FaBell, 
  FaPlus, 
  FaSearch,
  FaCalendarAlt,
  FaChartLine
} from 'react-icons/fa';
import { GiReceiveMoney } from 'react-icons/gi';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import ClientModal from '../components/ClientModal';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalClients: 0,
    activeClients: 0,
    pendingPayments: 0,
    totalRevenue: 0
  });
  const [recentClients, setRecentClients] = useState([]);
  const [upcomingPayments, setUpcomingPayments] = useState([]);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const [clientsRes, paymentsRes] = await Promise.all([
        axios.get('/clients?limit=5'),
        axios.get('/payments/upcoming')
      ]);

      const clients = clientsRes.data.clients || [];
      const payments = paymentsRes.data.payments || [];

      setStats({
        totalClients: clients.length,
        activeClients: clients.filter(c => c.status === 'active').length,
        pendingPayments: payments.filter(p => p.status === 'pending').length,
        totalRevenue: payments
          .filter(p => p.status === 'paid')
          .reduce((sum, p) => sum + p.amount, 0)
      });

      setRecentClients(clients);
      setUpcomingPayments(payments.slice(0, 5));
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Clients',
      value: stats.totalClients,
      icon: <FaUsers className="h-6 w-6" />,
      color: 'bg-blue-500',
      link: '/clients'
    },
    {
      title: 'Active Clients',
      value: stats.activeClients,
      icon: <FaUsers className="h-6 w-6" />,
      color: 'bg-green-500',
      link: '/clients?status=active'
    },
    {
      title: 'Pending Payments',
      value: stats.pendingPayments,
      icon: <GiReceiveMoney className="h-6 w-6" />,
      color: 'bg-yellow-500',
      link: '/payments?status=pending'
    },
    {
      title: 'Total Revenue',
      value: new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: user?.region?.currency || 'INR'
      }).format(stats.totalRevenue),
      icon: <FaChartLine className="h-6 w-6" />,
      color: 'bg-purple-500',
      link: '/payments'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">
            Welcome back, {user?.name}! Here's your overview.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsClientModalOpen(true)}
            className="flex items-center gap-2 bg-deepseek-blue text-white px-4 py-2 rounded-lg hover:bg-deepseek-dark transition-colors"
          >
            <FaPlus />
            Add Client
          </button>
          <Link
            to="/clients"
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FaSearch />
            Find Clients
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl shadow p-6"
          >
            <Link to={stat.link} className="block">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {stat.value}
                  </p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg text-white`}>
                  {stat.icon}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Clients */}
        <div className="bg-white rounded-xl shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Clients</h2>
              <Link to="/clients" className="text-deepseek-blue hover:underline text-sm">
                View all
              </Link>
            </div>
          </div>
          <div className="p-6">
            {recentClients.length > 0 ? (
              <div className="space-y-4">
                {recentClients.map((client, index) => (
                  <motion.div
                    key={client._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold">
                          {client.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{client.name}</p>
                        <p className="text-sm text-gray-600">{client.companyName}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      client.status === 'active' 
                        ? 'bg-green-100 text-green-800'
                        : client.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {client.status}
                    </span>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FaUsers className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No clients yet</p>
                <button
                  onClick={() => setIsClientModalOpen(true)}
                  className="mt-2 text-deepseek-blue hover:underline"
                >
                  Add your first client
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Payments */}
        <div className="bg-white rounded-xl shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Upcoming Payments</h2>
              <Link to="/payments" className="text-deepseek-blue hover:underline text-sm">
                View all
              </Link>
            </div>
          </div>
          <div className="p-6">
            {upcomingPayments.length > 0 ? (
              <div className="space-y-4">
                {upcomingPayments.map((payment, index) => (
                  <motion.div
                    key={payment._id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                        <FaCalendarAlt className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{payment.description}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>{payment.clientName}</span>
                          <span>•</span>
                          <span>Due: {new Date(payment.dueDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">
                        {new Intl.NumberFormat('en-IN', {
                          style: 'currency',
                          currency: payment.currency || user?.region?.currency || 'INR'
                        }).format(payment.amount)}
                      </p>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        payment.status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {payment.status}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FaMoneyCheckAlt className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No upcoming payments</p>
                <Link to="/clients" className="mt-2 text-deepseek-blue hover:underline block">
                  Add payment schedules
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/clients"
            className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FaUsers className="h-8 w-8 text-deepseek-blue mb-2" />
            <span className="text-sm font-medium">Manage Clients</span>
          </Link>
          <Link
            to="/payments"
            className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FaMoneyCheckAlt className="h-8 w-8 text-green-500 mb-2" />
            <span className="text-sm font-medium">Payments</span>
          </Link>
          <Link
            to="/notifications"
            className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FaBell className="h-8 w-8 text-yellow-500 mb-2" />
            <span className="text-sm font-medium">Notifications</span>
          </Link>
          <button
            onClick={() => setIsClientModalOpen(true)}
            className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FaPlus className="h-8 w-8 text-purple-500 mb-2" />
            <span className="text-sm font-medium">Add Client</span>
          </button>
        </div>
      </div>

      {/* Client Modal */}
      {isClientModalOpen && (
        <ClientModal
          isOpen={isClientModalOpen}
          onClose={() => setIsClientModalOpen(false)}
          onSuccess={fetchDashboardData}
        />
      )}
    </div>
  );
};

export default Dashboard;