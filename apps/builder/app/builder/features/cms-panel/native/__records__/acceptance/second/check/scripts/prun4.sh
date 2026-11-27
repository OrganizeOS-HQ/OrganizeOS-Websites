#!/bin/bash
# prun.sh <side base|head> <lens> <test file> [timeout] : one check-5 probe file at one build.
A=/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad/acceptance
SP=/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad
R=/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad/sc/lens
side=$1; lens=$2; file=$3; tmo=${4:-600}; tag=${5:-}; filt=${6:-}
case $side in base) W=$SP/r1-base;; r1) W=/home/user/OrganizeOS-Websites/.claude/worktrees/agent-abb012d24ba04b6c7;; esac
N=$W/apps/builder/app/builder/features/cms-panel/native
stem=${file%.test.tsx}
sub=zzchk-p5-$lens-${stem#zzv15-}$tag
D=$N/$sub
O=$SP/sc/probes/out/$side/$lens/${file%.test.tsx}$tag
rm -rf $D $O; mkdir -p $D $O
for f in $R/$lens/*.ts $R/$lens/*.tsx; do
  case $(basename $f) in *.test.tsx) ;; b-*|p-*|t-*) ;; *) cp $f $D/;; esac
done
cp $R/$lens/$file $D/
cp $A/probes/img.png $D/img.png
sed -i 's#from "\./rich-text-#from "../rich-text-#g' $D/*.ts $D/*.tsx 2>/dev/null
sed -i "s#native/zzv15-[a-z-]*/img.png#native/$sub/img.png#g" $D/*.ts $D/*.tsx 2>/dev/null
ls $D > $O/.sources
unset VITE_LINES_OFF
export PLAYWRIGHT_BROWSERS_PATH=/home/user/pw-browsers
start=$(date +%s)
(cd $W && setsid timeout -s KILL $tmo pnpm --filter @webstudio-is/builder exec vitest run --reporter=verbose --project core-browser-builder-cms app/builder/features/cms-panel/native/$sub/$file ${filt:+-t "$filt"}) > $O/log.txt 2>&1
echo "exit $? secs $(( $(date +%s) - start ))" >> $O/log.txt
for f in $D/*; do
  b=$(basename $f)
  grep -qx "$b" $O/.sources || mv $f $O/
done
for f in $W/apps/builder/out-*.json $W/out-*.json $W/apps/builder/zz*.json $W/apps/builder/zz*.jsonl; do [ -e "$f" ] && mv $f $O/; done
rm -rf $D
pkill -f "$sub/" 2>/dev/null
echo "$(date +%H:%M:%S) $side $lens $file $(tail -1 $O/log.txt) $(grep -E '^ +Tests ' $O/log.txt | tail -1)"
