/**
 * GitInternalAPI — 供其他模块调用的内部 Git 操作接口
 * 返回 commit hash 等结构化数据，而非原始 CLI 输出
 */

export interface GitInternalApi {
  /** 自动暂存并提交变更，返回 commit hash */
  autoCommit(opts: { cwd: string; message: string; paths?: string[] }): Promise<AutoCommitResult>

  /** 获取当前分支名 */
  getCurrentBranch(cwd: string): Promise<string>

  /** 获取工作区状态摘要 */
  getStatusSummary(cwd: string): Promise<GitStatusSummary>

  /** 获取最近 N 条提交 */
  getRecentCommits(cwd: string, count: number): Promise<GitCommitInfo[]>
}

export interface AutoCommitResult {
  success: boolean
  hash?: string
  error?: string
}

export interface GitStatusSummary {
  branch: string
  ahead: number
  behind: number
  staged: number
  unstaged: number
  untracked: number
  conflicted: number
}

export interface GitCommitInfo {
  hash: string
  shortHash: string
  message: string
  author: string
  date: string
  refs?: string
}

/** 验证 clone URL 安全性：拒绝 file:// 协议 */
export function validateCloneUrl(url: string): { valid: boolean; error?: string } {
  if (url.startsWith('file://') || url.startsWith('file:\\\\')) {
    return { valid: false, error: 'file:// protocol is not allowed for security reasons' }
  }

  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'file:') {
      return { valid: false, error: 'file:// protocol is not allowed' }
    }
  } catch {
    // Not a valid URL, could be a local path or SCP-style git@host:repo
  }

  return { valid: true }
}
