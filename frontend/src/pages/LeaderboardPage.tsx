import { useState } from 'react';
import { useTheme } from '../lib/themeContext.tsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface LeaderboardUser {
  id: string;
  username: string;
  email: string;
  points: number;
  daily_streak: number;
  total_earnings: number;
  is_friend: boolean;
  profile_image_url?: string;
}

interface Achievement {
  title: string;
  description: string;
  icon: string;
}

interface LeaderboardPageProps {
  onBack?: () => void;
}

export function LeaderboardPage({ onBack }: LeaderboardPageProps) {
  const { config } = useTheme();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [selectedTab, setSelectedTab] = useState<'global' | 'friends' | 'achievements'>('global');
  const [congratsMessage, setCongratsMessage] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);

  const isDarkTheme = config.name !== 'simple-light';

  // Fetch leaderboard data
  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      return res.json();
    }
  });

  // Add friend mutation
  const addFriendMutation = useMutation({
    mutationFn: async (emailOrUsername: string) => {
      const res = await fetch('/api/leaderboard/add-friend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_email_or_username: emailOrUsername })
      });
      if (!res.ok) throw new Error('Failed to add friend');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      setSearchInput('');
    }
  });

  // Send congratulations mutation
  const sendCongratsMutation = useMutation({
    mutationFn: async (friendId: string) => {
      const res = await fetch('/api/leaderboard/send-congrats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_id: friendId, message: congratsMessage })
      });
      if (!res.ok) throw new Error('Failed to send congratulations');
      return res.json();
    },
    onSuccess: () => {
      setCongratsMessage('');
      setSelectedFriend(null);
    }
  });

  if (isLoading) {
    return (
      <div className={`min-h-screen ${isDarkTheme ? 'bg-slate-900' : 'bg-white'}`}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-xl">Loading...</div>
        </div>
      </div>
    );
  }

  const leaderboard = leaderboardData?.leaderboard || [];
  const friends = leaderboardData?.friends || [];
  const achievements = leaderboardData?.achievements || [];

  const renderLeaderboardItem = (user: LeaderboardUser, index: number, isFriendView: boolean = false): JSX.Element => (
    <div
      key={user.id}
      className={`flex items-center justify-between p-4 rounded-lg border ${
        isDarkTheme
          ? 'bg-slate-800 border-slate-700 hover:bg-slate-700'
          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
      }`}
    >
      <div className="flex items-center gap-4 flex-1">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
          index === 0 ? 'bg-yellow-500' :
          index === 1 ? 'bg-gray-400' :
          index === 2 ? 'bg-orange-400' :
          isDarkTheme ? 'bg-slate-600' : 'bg-gray-300'
        } text-white`}>
          {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
        </div>
        <div className="flex-1">
          <div className="font-semibold">{user.username}</div>
          <div className={`text-sm ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>
            {user.total_earnings.toFixed(2)} miles earned
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-bold text-lg">{user.points}</div>
        <div className={`text-xs ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>points</div>
      </div>
      {isFriendView && (
        <button
          onClick={() => setSelectedFriend(user.id)}
          className={`ml-4 px-3 py-1 rounded text-sm font-medium ${
            isDarkTheme
              ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          🎉 Congrats
        </button>
      )}
      {!isFriendView && !user.is_friend && (
        <button
          onClick={() => addFriendMutation.mutate(user.email)}
          disabled={addFriendMutation.isPending}
          className={`ml-4 px-3 py-1 rounded text-sm font-medium ${
            isDarkTheme
              ? 'bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50'
              : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
          }`}
        >
          + Add
        </button>
      )}
    </div>
  );

  return (
    <div className={`min-h-screen ${isDarkTheme ? 'bg-slate-900' : 'bg-white'}`}>
      {/* Header */}
      <div className={`p-6 border-b ${isDarkTheme ? 'border-slate-700' : 'border-gray-200'}`}>
        <button
          onClick={onBack || (() => window.history.back())}
          className={`mb-4 text-sm font-medium ${isDarkTheme ? 'text-cyan-400' : 'text-blue-600'}`}
        >
          ← Back
        </button>
        <h1 className={`text-4xl font-black mb-2 ${config.titleColor}`}>
          🏆 LEADERBOARD
        </h1>
        <p className={`text-sm ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>
          Compete with friends and earn achievements
        </p>
      </div>

      {/* Tabs */}
      <div className={`flex border-b ${isDarkTheme ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'}`}>
        {(['global', 'friends', 'achievements'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`flex-1 py-4 font-semibold transition-colors ${
              selectedTab === tab
                ? isDarkTheme
                  ? 'border-b-2 border-cyan-500 text-cyan-400'
                  : 'border-b-2 border-blue-600 text-blue-600'
                : isDarkTheme
                ? 'text-slate-400 hover:text-slate-300'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab === 'global' && '🌍 Global'}
            {tab === 'friends' && '👥 Friends'}
            {tab === 'achievements' && '⭐ Achievements'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        {selectedTab === 'global' && (
          <>
            <div className={`p-4 rounded-lg ${isDarkTheme ? 'bg-slate-800' : 'bg-gray-50'}`}>
              <input
                type="text"
                placeholder="Search by email or username..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg border-2 ${
                  isDarkTheme
                    ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
              {searchInput && (
                <button
                  onClick={() => addFriendMutation.mutate(searchInput)}
                  disabled={addFriendMutation.isPending}
                  className={`w-full mt-2 py-2 rounded font-medium ${
                    isDarkTheme
                      ? 'bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50'
                      : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
                  }`}
                >
                  Add Friend
                </button>
              )}
            </div>
            <div className="space-y-2">
              {leaderboard.slice(0, 50).map((user, idx) => renderLeaderboardItem(user, idx))}
            </div>
          </>
        )}

        {selectedTab === 'friends' && (
          <div className="space-y-2">
            {friends.length === 0 ? (
              <div className={`p-8 text-center ${isDarkTheme ? 'bg-slate-800' : 'bg-gray-50'} rounded-lg`}>
                <p className={isDarkTheme ? 'text-slate-400' : 'text-gray-600'}>
                  No friends yet. Add friends from the Global tab!
                </p>
              </div>
            ) : (
              friends.map((user, idx) => renderLeaderboardItem(user, idx, true))
            )}
          </div>
        )}

        {selectedTab === 'achievements' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {achievements.length === 0 ? (
              <div className={`col-span-full p-8 text-center ${isDarkTheme ? 'bg-slate-800' : 'bg-gray-50'} rounded-lg`}>
                <p className={isDarkTheme ? 'text-slate-400' : 'text-gray-600'}>
                  No achievements yet. Keep tracking to unlock achievements!
                </p>
              </div>
            ) : (
              achievements.map((achievement: Achievement, idx: number) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${
                    isDarkTheme
                      ? 'bg-slate-800 border-slate-700'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="text-3xl mb-2">{achievement.icon || '⭐'}</div>
                  <div className="font-bold">{achievement.title}</div>
                  <div className={`text-sm ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>
                    {achievement.description}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Congratulations Modal */}
      {selectedFriend && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className={`rounded-lg p-6 max-w-md w-full ${isDarkTheme ? 'bg-slate-900' : 'bg-white'}`}>
            <h3 className="text-xl font-bold mb-4">Send Congratulations! 🎉</h3>
            <textarea
              value={congratsMessage}
              onChange={(e) => setCongratsMessage(e.target.value)}
              placeholder="Great job on your achievements!"
              className={`w-full px-3 py-2 rounded-lg border-2 mb-4 ${
                isDarkTheme
                  ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedFriend(null)}
                className={`flex-1 py-2 rounded font-medium ${
                  isDarkTheme
                    ? 'bg-slate-700 hover:bg-slate-600 text-white'
                    : 'bg-gray-300 hover:bg-gray-400 text-gray-900'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => sendCongratsMutation.mutate(selectedFriend)}
                disabled={sendCongratsMutation.isPending}
                className={`flex-1 py-2 rounded font-medium ${
                  isDarkTheme
                    ? 'bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50'
                    : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
                }`}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
