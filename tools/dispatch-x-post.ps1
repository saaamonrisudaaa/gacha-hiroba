param(
  [ValidateSet('due', 'morning', 'noon', 'afternoon', 'evening')]
  [string]$Slot = 'due',
  [switch]$DryRun,
  [switch]$VerifyOnly,
  [switch]$Wait
)

$ErrorActionPreference = 'Stop'
$repository = 'saaamonrisudaaa/gacha-hiroba'
$workflow = 'x-post.yml'
$startedAt = [DateTimeOffset]::UtcNow
$dryRunValue = if ($DryRun) { '1' } else { '0' }
$verifyOnlyValue = if ($VerifyOnly) { '1' } else { '0' }

gh workflow run $workflow `
  --repo $repository `
  --ref main `
  -f "dry_run=$dryRunValue" `
  -f "slot=$Slot" `
  -f "verify_only=$verifyOnlyValue"

if ($LASTEXITCODE -ne 0) {
  throw 'X投稿ワークフローの起動に失敗しました'
}

$run = $null
for ($attempt = 0; $attempt -lt 10 -and -not $run; $attempt++) {
  Start-Sleep -Seconds 2
  $runs = gh run list `
    --repo $repository `
    --workflow $workflow `
    --event workflow_dispatch `
    --limit 10 `
    --json databaseId,createdAt,status,conclusion,url | ConvertFrom-Json
  $run = $runs |
    Where-Object { [DateTimeOffset]$_.createdAt -ge $startedAt.AddSeconds(-5) } |
    Sort-Object { [DateTimeOffset]$_.createdAt } -Descending |
    Select-Object -First 1
}

if (-not $run) {
  throw '起動したX投稿ワークフローを確認できませんでした'
}

Write-Output "X投稿ワークフロー: $($run.url)"
if ($Wait) {
  gh run watch $run.databaseId --repo $repository --exit-status --interval 5
  if ($LASTEXITCODE -ne 0) {
    throw "X投稿ワークフローが失敗しました: $($run.url)"
  }
}
