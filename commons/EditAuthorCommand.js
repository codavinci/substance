import { $$ } from '../dom'
import AuthorModal from './AuthorModal'
import ItemCommand from './_ItemCommand'

export default class EditAuthorCommand extends ItemCommand {
  getType () {
    return 'author'
  }

  execute (params, context) {
    const commandState = params.commandState
    const node = commandState.node
    context.editorSession.getRootComponent().send('requestModal', () => {
      return $$(AuthorModal, { mode: 'edit', node })
    }).then(modal => {
      if (!modal) return
      // TODO: considering collab we should do a more minimal update
      // i.e. using incremental changes
      const firstName = modal.refs.firstName.val()
      const lastName = modal.refs.lastName.val()
      context.api.updateNode(node.id, { firstName, lastName })
    })
  }
}