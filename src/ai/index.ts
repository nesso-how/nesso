import { defaultLocale } from '@nesso-how/i18n'
import { createAiChat } from './chat.ts'
import { createAiApproval } from './approval.ts'
import type { AiPlugins } from './plugins.ts'
import { host } from '../store/index.ts'
import { notifications } from '../notifications/index.ts'
import { translate } from '../i18n/index.ts'
import { describePlugins, proposeLocalPlugin } from '../plugins/index.ts'
import { documentation } from './docs.ts'

export { documentation }
export const aiPlugins: AiPlugins = { list: describePlugins, propose: proposeLocalPlugin }
export const chat = window.nessoAi
  ? createAiChat(
      window.nessoAi,
      host.store,
      documentation,
      createAiApproval(
        notifications.api,
        () => translate(host.store.getState().preferences.locale ?? defaultLocale),
        'aiRemovalApproval',
      ),
    )
  : undefined
