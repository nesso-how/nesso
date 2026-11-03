import { Component, type ReactNode } from 'react'
import { defaultLocale } from '@nesso-how/i18n'
import { translate } from '@/i18n'
import { nessoStore } from '@/store'

type Props = { children: ReactNode; save: () => Promise<boolean> }
type State = { failed: boolean; saving: boolean; saveFailed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, saving: false, saveFailed: false }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  reload = async () => {
    this.setState({ saving: true, saveFailed: false })
    if (await this.props.save().catch(() => false)) location.reload()
    else this.setState({ saving: false, saveFailed: true })
  }

  render() {
    if (!this.state.failed) return this.props.children
    const t = translate(nessoStore.getState().preferences.locale ?? defaultLocale)
    return (
      <div role="alert" className="startup-recovery">
        <p>{t(this.state.saveFailed ? 'appSaveFailed' : 'appFailed')}</p>
        <button disabled={this.state.saving} onClick={() => void this.reload()}>
          {t('pluginsRetry')}
        </button>
        {this.state.saveFailed && (
          <button onClick={() => location.reload()}>{t('appReloadUnsaved')}</button>
        )}
      </div>
    )
  }
}
