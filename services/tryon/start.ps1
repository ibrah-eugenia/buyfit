# Lance le service d'essayage (Windows) : Qwen-Image-Edit-2511 (Hugging Face) pour le mannequin
# et l'essayage (TRYON_ENGINE=legacy : FLUX.1 Kontext + IDM-VTON). HF_TOKEN et SUPABASE_URL sont lus dans le .env racine.
# Usage, depuis services/tryon : .\start.ps1
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$values = @{}
Get-Content (Join-Path $root ".env") | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)=(.*)$') { $values[$Matches[1]] = $Matches[2].Trim().Trim('"') }
}
if (-not $values["HF_TOKEN"]) { throw "HF_TOKEN manquant dans le .env racine" }

$env:TRYON_MODE = "huggingface"
# Qwen-Image-Edit-2511 via Hugging Face (WaveSpeed) pour le mannequin et l'essayage.
$env:TRYON_ENGINE = "qwen"
$env:HF_TOKEN = $values["HF_TOKEN"]
$env:HF_SPACE_ID = "yisol/IDM-VTON"
# Hôtes HTTPS autorisés pour les images : Pinterest, démo, photos produit Zara / Uniqlo,
# et le projet Supabase (mannequins stockés dans le bucket privé).
$hosts = @("i.pinimg.com", "images.unsplash.com", "static.zara.net", "image.uniqlo.com")
if ($values["SUPABASE_URL"]) { $hosts += ([Uri]$values["SUPABASE_URL"]).Host }
$env:TRYON_IMAGE_HOSTS = $hosts -join ","

Set-Location $PSScriptRoot
& ".\.venv\Scripts\python.exe" -m uvicorn app:app --host 127.0.0.1 --port 8000 --no-access-log
