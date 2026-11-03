$env:PATH = "C:\Program Files\nodejs;$env:PATH"
Set-Location "C:\Users\fgzlr\.gemini\antigravity\scratch\pulselab"

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  1/3 Compilando PulseLab (Firebase Auth + Supabase) " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
npm.cmd run build

Write-Host "`n=====================================================" -ForegroundColor Cyan
Write-Host "  2/3 Publicando Reglas y Hosting en Firebase        " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
npx.cmd firebase login
npx.cmd firebase deploy --only firestore:rules,hosting

Write-Host "`n=====================================================" -ForegroundColor Cyan
Write-Host "  3/3 Subiendo rama migracion-supabase a GitHub      " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
cmdkey /delete:git:https://github.com 2>$null
git push -u origin migracion-supabase

Write-Host "`n¡Proceso terminado! Presiona Enter para cerrar..." -ForegroundColor Green
Read-Host
