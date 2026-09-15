import React, { useState } from 'react';
import { X, Hash, Volume2 } from 'lucide-react';
import { ChannelType } from '../types';

interface CreateChannelModalProps {
  onClose: () => void;
  onCreate: (name: string, type: ChannelType, topic: string) => void;
  defaultCategoryId?: string;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  onClose,
  onCreate
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<ChannelType>('text');
  const [topic, setTopic] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const formattedName = name.trim().toLowerCase().replace(/\s+/g, '-');
    onCreate(formattedName, type, topic.trim());
    onClose();
  };

  return (
    <div
      id="create-channel-modal"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md bg-[#313338] rounded-xl shadow-2xl border border-[#232428] overflow-hidden">
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-[#232428]">
          <h2 className="text-xl font-bold text-white">Create Channel</h2>
          <button onClick={onClose} className="text-[#b5bac1] hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Channel Type */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#b5bac1] uppercase tracking-wider">
              Channel Type
            </label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setType('text')}
                className={`w-full p-3 rounded-lg flex items-center gap-3 border text-left transition-colors ${
                  type === 'text'
                    ? 'bg-[#404249] border-[#5865F2] text-white'
                    : 'bg-[#2b2d31] border-transparent text-[#dbdee1] hover:bg-[#35373c]'
                }`}
              >
                <Hash size={24} className="text-[#949ba4]" />
                <div>
                  <div className="font-semibold text-sm">Text</div>
                  <div className="text-xs text-[#949ba4]">Post messages, images, memes, and code</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('voice')}
                className={`w-full p-3 rounded-lg flex items-center gap-3 border text-left transition-colors ${
                  type === 'voice'
                    ? 'bg-[#404249] border-[#5865F2] text-white'
                    : 'bg-[#2b2d31] border-transparent text-[#dbdee1] hover:bg-[#35373c]'
                }`}
              >
                <Volume2 size={24} className="text-[#949ba4]" />
                <div>
                  <div className="font-semibold text-sm">Voice</div>
                  <div className="text-xs text-[#949ba4]">Hang out together with voice, video, and screen share</div>
                </div>
              </button>
            </div>
          </div>

          {/* Channel Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#b5bac1] uppercase tracking-wider">
              Channel Name
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-[#949ba4]">
                {type === 'voice' ? <Volume2 size={16} /> : <Hash size={16} />}
              </span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="new-channel"
                className="w-full bg-[#1e1f22] text-white pl-9 pr-3 py-2 rounded-md border border-[#111214] text-sm focus:outline-none focus:ring-1 focus:ring-[#5865F2]"
                autoFocus
              />
            </div>
          </div>

          {/* Channel Topic */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#b5bac1] uppercase tracking-wider">
              Topic (Optional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What is this channel for?"
              className="w-full bg-[#1e1f22] text-white p-2 rounded-md border border-[#111214] text-sm focus:outline-none focus:ring-1 focus:ring-[#5865F2]"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-white hover:underline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-6 py-2 bg-[#5865F2] hover:bg-[#4752c4] text-white font-semibold rounded-md text-sm transition-colors disabled:opacity-50"
            >
              Create Channel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
