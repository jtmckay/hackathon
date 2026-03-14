import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initTechChannels,
  getTechByGroupId,
  getGroupIdByTech,
  isTechGroup,
  getAllTechChannels,
} from '../tech-channels.js';

// Mock Telegraf bot
function createMockBot() {
  return {
    telegram: {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
  } as any;
}

describe('tech-channels', () => {
  beforeEach(() => {
    // Clean env
    delete process.env.TELEGRAM_TECH_GROUP_MARCUS;
    delete process.env.TELEGRAM_TECH_GROUP_TYLER;
    delete process.env.TELEGRAM_TECH_GROUP_JAKE;
    delete process.env.TELEGRAM_TECH_GROUP_DANNY;
  });

  it('initializes channels from environment variables', () => {
    process.env.TELEGRAM_TECH_GROUP_MARCUS = '-100001';
    process.env.TELEGRAM_TECH_GROUP_TYLER = '-100002';
    process.env.TELEGRAM_TECH_GROUP_JAKE = '-100003';
    process.env.TELEGRAM_TECH_GROUP_DANNY = '-100004';

    const bot = createMockBot();
    initTechChannels(bot);

    const channels = getAllTechChannels();
    expect(channels).toHaveLength(4);
    expect(channels.map((c) => c.techId).sort()).toEqual([
      'danny',
      'jake',
      'marcus',
      'tyler',
    ]);
  });

  it('handles partial configuration (not all techs configured)', () => {
    process.env.TELEGRAM_TECH_GROUP_MARCUS = '-100001';
    process.env.TELEGRAM_TECH_GROUP_TYLER = '-100002';

    const bot = createMockBot();
    initTechChannels(bot);

    const channels = getAllTechChannels();
    expect(channels).toHaveLength(2);
  });

  it('resolves tech by group ID', () => {
    process.env.TELEGRAM_TECH_GROUP_MARCUS = '-100001';
    process.env.TELEGRAM_TECH_GROUP_TYLER = '-100002';

    const bot = createMockBot();
    initTechChannels(bot);

    expect(getTechByGroupId('-100001')).toBe('marcus');
    expect(getTechByGroupId('-100002')).toBe('tyler');
    expect(getTechByGroupId('-999999')).toBeNull();
  });

  it('resolves group ID by tech', () => {
    process.env.TELEGRAM_TECH_GROUP_MARCUS = '-100001';
    process.env.TELEGRAM_TECH_GROUP_JAKE = '-100003';

    const bot = createMockBot();
    initTechChannels(bot);

    expect(getGroupIdByTech('marcus')).toBe('-100001');
    expect(getGroupIdByTech('jake')).toBe('-100003');
    expect(getGroupIdByTech('danny')).toBeNull();
  });

  it('correctly identifies tech groups', () => {
    process.env.TELEGRAM_TECH_GROUP_MARCUS = '-100001';

    const bot = createMockBot();
    initTechChannels(bot);

    expect(isTechGroup('-100001')).toBe(true);
    expect(isTechGroup('-999999')).toBe(false);
  });

  it('handles no tech groups configured', () => {
    const bot = createMockBot();
    initTechChannels(bot);

    const channels = getAllTechChannels();
    expect(channels).toHaveLength(0);
    expect(getTechByGroupId('-100001')).toBeNull();
    expect(getGroupIdByTech('marcus')).toBeNull();
    expect(isTechGroup('-100001')).toBe(false);
  });
});
