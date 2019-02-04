import * as Path from 'path'
import * as FSE from 'fs-extra'

import { Repository } from '../../models/repository'
import { git } from './core'
import { WorkingDirectoryFileChange } from '../../models/status'
import { ManualConflictResolution } from '../../models/manual-conflict-resolution'
import { stageConflictedFile } from './stage'
import { stageFiles } from './update-index'

/**
 * Check the `.git/REBASE_HEAD` file exists in a repository to confirm
 * a rebase operation is underway.
 */
export function isRebaseHeadSet(repository: Repository) {
  const path = Path.join(repository.path, '.git', 'REBASE_HEAD')
  return FSE.pathExists(path)
}

/**
 * A stub function to use for initiating rebase in the app.
 *
 * If the rebase fails, the repository will be in an indeterminate state where
 * the rebase is stuck.
 *
 * If the rebase completes without error, `featureBranch` will be checked out
 * and it will probably have a different commit history.
 *
 * @param baseBranch the ref to start the rebase from
 * @param featureBranch the ref to rebase onto `baseBranch`
 */
export async function rebase(
  repository: Repository,
  baseBranch: string,
  featureBranch: string
) {
  return await git(
    ['rebase', baseBranch, featureBranch],
    repository.path,
    'abortRebase'
  )
}

/** Abandon the current rebase operation */
export async function abortRebase(repository: Repository) {
  await git(['rebase', '--abort'], repository.path, 'abortRebase')
}

/** Proceed with the current rebase operation */
export async function continueRebase(
  repository: Repository,
  files: ReadonlyArray<WorkingDirectoryFileChange>,
  manualResolutions: ReadonlyMap<string, ManualConflictResolution> = new Map()
) {
  // apply conflict resolutions
  for (const [path, resolution] of manualResolutions) {
    const file = files.find(f => f.path === path)
    if (file !== undefined) {
      await stageConflictedFile(repository, file, resolution)
    } else {
      log.error(
        `couldn't find file ${path} even though there's a manual resolution for it`
      )
    }
  }

  const otherFiles = files.filter(f => !manualResolutions.has(f.path))

  await stageFiles(repository, otherFiles)

  await git(['rebase', '--continue'], repository.path, 'continueRebase')
}
