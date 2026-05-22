import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// ─── Exercise → muscles mapping (exported for use in ExerciseSelectionScreen) ─
export const EXERCISE_MUSCLES = {
  'Squats':                  ['quads', 'hamstrings', 'glutes'],
  'Leg Press':               ['quads', 'hamstrings'],
  'Deadlifts':               ['lats', 'hamstrings', 'traps', 'lower_back'],
  'Close-Grip Pulldowns':    ['lats', 'biceps'],
  'Weighted Chin-Ups':       ['lats', 'biceps'],
  'Weighted Dips':           ['chest', 'triceps', 'shoulders'],
  'Incline Press':           ['chest', 'shoulders', 'triceps'],
  'Leg Curls':               ['hamstrings'],
  'Leg Extensions':          ['quads'],
  'Pec Deck':                ['chest'],
  'Dumbbell Flyes':          ['chest'],
  'Dumbbell Pullover':       ['lats'],
  'Dumbbell Lateral Raises': ['shoulders'],
  'Barbell Curls':           ['biceps'],
  'Triceps Pressdowns':      ['triceps'],
  'Standing Calf Raises':    ['calves'],
  'Shrugs':                  ['traps'],
};

// ─── HTML / SVG anatomy diagram ───────────────────────────────────────────────
const buildHTML = (sex) => {
  const male = sex !== 'female';

  // Shoulder width tweaks for male vs female
  const sh = male
    ? { lx: 47, rx: 153, w: 44 }
    : { lx: 51, rx: 149, w: 38 };
  const hip = male
    ? { x: 64, w: 72 }
    : { x: 58, w: 84 };

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;background:#0a0a0a;display:flex;flex-direction:column;align-items:center;padding-top:10px;}
.toggle{display:flex;margin-bottom:8px;border:1px solid #2c2c2e;border-radius:6px;overflow:hidden;}
.tb{padding:7px 20px;background:#1c1c1e;color:#555;font:700 10px/1 -apple-system,sans-serif;letter-spacing:1.5px;cursor:pointer;border:none;outline:none;-webkit-tap-highlight-color:transparent;}
.tb.on{background:#c9a84c;color:#000;}
svg{width:170px;height:auto;display:block;}
.struct{fill:#222;stroke:#383838;stroke-width:0.7;}
.inactive{fill:#e05c5c;fill-opacity:0.18;stroke:#e05c5c;stroke-opacity:0.45;stroke-width:0.8;transition:fill 0.25s,fill-opacity 0.25s,stroke-opacity 0.25s;}
.active{fill:#c9a84c;fill-opacity:0.6;stroke:#c9a84c;stroke-opacity:1;stroke-width:1;filter:drop-shadow(0 0 5px rgba(201,168,76,0.55));transition:fill 0.25s,fill-opacity 0.25s,stroke-opacity 0.25s;}
.lbl{font:700 8px/1 -apple-system,sans-serif;letter-spacing:2px;fill:#444;text-anchor:middle;}
</style>
</head>
<body>
<div class="toggle">
  <button class="tb on" id="btn-front" onclick="setView('front')">FRONT</button>
  <button class="tb"    id="btn-back"  onclick="setView('back')">BACK</button>
</div>

<!-- ═══════════════════════════════════════════════
     FRONT VIEW
════════════════════════════════════════════════ -->
<svg id="svg-front" viewBox="0 0 200 490">

  <!-- Body structure (drawn back→front so muscles render on top) -->
  <!-- Forearms -->
  <ellipse class="struct" cx="38"  cy="202" rx="10" ry="36" transform="rotate(-7,38,202)"/>
  <ellipse class="struct" cx="162" cy="202" rx="10" ry="36" transform="rotate(7,162,202)"/>
  <!-- Hands -->
  <ellipse class="struct" cx="34"  cy="244" rx="8"  ry="12"/>
  <ellipse class="struct" cx="166" cy="244" rx="8"  ry="12"/>
  <!-- Head -->
  <ellipse class="struct" cx="100" cy="28" rx="22" ry="27"/>
  <!-- Neck -->
  <path class="struct" d="M91,53 Q91,67 100,68 Q109,67 109,53 Z"/>
  <!-- Torso -->
  <path class="struct" d="
    M ${sh.lx},66 Q 56,72 55,100 Q 54,128 56,152 Q 58,172 62,184
    Q 68,200 ${hip.x},204
    L ${hip.x + hip.w},204
    Q ${200 - 62},200 ${200 - 56},184
    Q ${200 - 56},172 ${200 - 56},152
    Q ${200 - 54},128 ${200 - 55},100
    Q ${200 - 56},72 ${200 - sh.lx},66 Z
  "/>
  <!-- Hips -->
  <path class="struct" d="
    M ${hip.x},202
    Q ${hip.x - 8},212 ${hip.x - 4},228
    Q ${hip.x + 4},244 ${hip.x + 16},248
    L ${hip.x + hip.w - 16},248
    Q ${hip.x + hip.w + 4},244 ${hip.x + hip.w + 12},228
    Q ${hip.x + hip.w + 16},212 ${hip.x + hip.w},202 Z
  "/>
  <!-- Upper arms -->
  <ellipse class="struct" cx="44"  cy="126" rx="13" ry="46" transform="rotate(-5,44,126)"/>
  <ellipse class="struct" cx="156" cy="126" rx="13" ry="46" transform="rotate(5,156,126)"/>
  <!-- Thighs -->
  <ellipse class="struct" cx="80"  cy="294" rx="22" ry="52"/>
  <ellipse class="struct" cx="120" cy="294" rx="22" ry="52"/>
  <!-- Lower legs -->
  <ellipse class="struct" cx="76"  cy="382" rx="15" ry="44"/>
  <ellipse class="struct" cx="124" cy="382" rx="15" ry="44"/>
  <!-- Feet -->
  <ellipse class="struct" cx="72"  cy="436" rx="13" ry="9"/>
  <ellipse class="struct" cx="128" cy="436" rx="13" ry="9"/>

  <!-- ── MUSCLE ZONES ─────────────────────────────────── -->

  <!-- CHEST — pectoralis major, fan from sternum -->
  <path data-muscle="chest" d="
    M 67,74 Q 74,66 86,70 Q 96,73 100,76
    L 100,108 Q 96,120 88,118 Q 76,114 68,104 Q 60,92 67,74 Z"/>
  <path data-muscle="chest" d="
    M 133,74 Q 126,66 114,70 Q 104,73 100,76
    L 100,108 Q 104,120 112,118 Q 124,114 132,104 Q 140,92 133,74 Z"/>

  <!-- SHOULDERS — anterior deltoid cap -->
  <path data-muscle="shoulders" d="
    M ${sh.lx},66 Q ${sh.lx - 4},58 ${sh.lx + 10},60
    Q ${sh.lx + 20},62 ${sh.lx + 22},72
    Q ${sh.lx + 20},84 ${sh.lx + 10},86
    Q ${sh.lx - 2},84 ${sh.lx - 4},76 Z"/>
  <path data-muscle="shoulders" d="
    M ${200 - sh.lx},66 Q ${200 - sh.lx + 4},58 ${200 - sh.lx - 10},60
    Q ${200 - sh.lx - 20},62 ${200 - sh.lx - 22},72
    Q ${200 - sh.lx - 20},84 ${200 - sh.lx - 10},86
    Q ${200 - sh.lx + 2},84 ${200 - sh.lx + 4},76 Z"/>

  <!-- BICEPS — brachii, front of upper arm -->
  <path data-muscle="biceps" d="
    M 34,100 Q 40,94 49,97
    Q 56,102 56,120 Q 56,142 51,158
    Q 47,166 39,163 Q 32,156 31,138 Q 30,116 34,100 Z"/>
  <path data-muscle="biceps" d="
    M 166,100 Q 160,94 151,97
    Q 144,102 144,120 Q 144,142 149,158
    Q 153,166 161,163 Q 168,156 169,138 Q 170,116 166,100 Z"/>

  <!-- QUADS — rectus femoris + vastus, front thigh -->
  <path data-muscle="quads" d="
    M 60,252 Q 66,244 78,246 Q 88,250 90,270
    Q 92,294 88,318 Q 84,336 76,338
    Q 64,336 58,318 Q 52,298 54,272 Q 56,258 60,252 Z"/>
  <path data-muscle="quads" d="
    M 140,252 Q 134,244 122,246 Q 112,250 110,270
    Q 108,294 112,318 Q 116,336 124,338
    Q 136,336 142,318 Q 148,298 146,272 Q 144,258 140,252 Z"/>

  <!-- CALVES — tibialis anterior, front lower leg -->
  <path data-muscle="calves" d="
    M 66,346 Q 72,338 79,342 Q 86,348 84,370
    Q 82,388 76,394 Q 68,394 64,384 Q 60,370 62,356 Q 62,350 66,346 Z"/>
  <path data-muscle="calves" d="
    M 134,346 Q 128,338 121,342 Q 114,348 116,370
    Q 118,388 124,394 Q 132,394 136,384 Q 140,370 138,356 Q 138,350 134,346 Z"/>

</svg>

<!-- ═══════════════════════════════════════════════
     BACK VIEW
════════════════════════════════════════════════ -->
<svg id="svg-back" viewBox="0 0 200 490" style="display:none">

  <!-- Body structure -->
  <ellipse class="struct" cx="38"  cy="202" rx="10" ry="36" transform="rotate(-7,38,202)"/>
  <ellipse class="struct" cx="162" cy="202" rx="10" ry="36" transform="rotate(7,162,202)"/>
  <ellipse class="struct" cx="34"  cy="244" rx="8"  ry="12"/>
  <ellipse class="struct" cx="166" cy="244" rx="8"  ry="12"/>
  <ellipse class="struct" cx="100" cy="28"  rx="22" ry="27"/>
  <path class="struct" d="M91,53 Q91,67 100,68 Q109,67 109,53 Z"/>
  <path class="struct" d="
    M ${sh.lx},66 Q 56,72 55,100 Q 54,128 56,152 Q 58,172 62,184
    Q 68,200 ${hip.x},204
    L ${hip.x + hip.w},204
    Q ${200 - 62},200 ${200 - 56},184
    Q ${200 - 56},172 ${200 - 56},152
    Q ${200 - 54},128 ${200 - 55},100
    Q ${200 - 56},72 ${200 - sh.lx},66 Z
  "/>
  <path class="struct" d="
    M ${hip.x},202
    Q ${hip.x - 8},212 ${hip.x - 4},228
    Q ${hip.x + 4},244 ${hip.x + 16},248
    L ${hip.x + hip.w - 16},248
    Q ${hip.x + hip.w + 4},244 ${hip.x + hip.w + 12},228
    Q ${hip.x + hip.w + 16},212 ${hip.x + hip.w},202 Z
  "/>
  <ellipse class="struct" cx="44"  cy="126" rx="13" ry="46" transform="rotate(-5,44,126)"/>
  <ellipse class="struct" cx="156" cy="126" rx="13" ry="46" transform="rotate(5,156,126)"/>
  <ellipse class="struct" cx="80"  cy="294" rx="22" ry="52"/>
  <ellipse class="struct" cx="120" cy="294" rx="22" ry="52"/>
  <ellipse class="struct" cx="76"  cy="382" rx="15" ry="44"/>
  <ellipse class="struct" cx="124" cy="382" rx="15" ry="44"/>
  <ellipse class="struct" cx="72"  cy="436" rx="13" ry="9"/>
  <ellipse class="struct" cx="128" cy="436" rx="13" ry="9"/>

  <!-- ── MUSCLE ZONES ─────────────────────────────────── -->

  <!-- TRAPEZIUS — upper back / neck, kite shape -->
  <path data-muscle="traps" d="
    M 100,56 Q 118,58 ${200 - sh.lx + 4},68
    Q ${200 - sh.lx + 8},80 ${200 - sh.lx},88
    Q 118,94 100,96 Q 82,94 ${sh.lx},88
    Q ${sh.lx - 8},80 ${sh.lx - 4},68
    Q 82,58 100,56 Z"/>

  <!-- LATS — latissimus dorsi, large wing shape -->
  <path data-muscle="lats" d="
    M 56,90 Q 62,84 72,88 Q 80,94 78,116
    Q 76,142 72,166 Q 68,182 60,184
    Q 52,182 50,164 Q 48,140 50,114 Q 52,96 56,90 Z"/>
  <path data-muscle="lats" d="
    M 144,90 Q 138,84 128,88 Q 120,94 122,116
    Q 124,142 128,166 Q 132,182 140,184
    Q 148,182 150,164 Q 152,140 150,114 Q 148,96 144,90 Z"/>

  <!-- LOWER BACK — erector spinae -->
  <path data-muscle="lower_back" d="
    M 78,164 Q 86,158 100,160 Q 114,158 122,164
    Q 126,174 122,188 Q 114,196 100,198
    Q 86,196 78,188 Q 74,174 78,164 Z"/>

  <!-- TRICEPS — back of upper arm, horseshoe -->
  <path data-muscle="triceps" d="
    M 33,102 Q 40,96 47,99
    Q 54,104 54,122 Q 54,144 49,158
    Q 45,166 38,164 Q 31,158 30,140 Q 29,118 33,102 Z"/>
  <path data-muscle="triceps" d="
    M 167,102 Q 160,96 153,99
    Q 146,104 146,122 Q 146,144 151,158
    Q 155,166 162,164 Q 169,158 170,140 Q 171,118 167,102 Z"/>

  <!-- GLUTES — gluteus maximus -->
  <path data-muscle="glutes" d="
    M ${hip.x - 2},208 Q ${hip.x + 4},202 ${hip.x + 16},204
    Q ${hip.x + 30},208 ${hip.x + 30},226
    Q ${hip.x + 28},244 ${hip.x + 14},250
    Q ${hip.x - 2},250 ${hip.x - 8},238
    Q ${hip.x - 10},222 ${hip.x - 2},208 Z"/>
  <path data-muscle="glutes" d="
    M ${hip.x + hip.w + 2},208 Q ${hip.x + hip.w - 4},202 ${hip.x + hip.w - 16},204
    Q ${hip.x + hip.w - 30},208 ${hip.x + hip.w - 30},226
    Q ${hip.x + hip.w - 28},244 ${hip.x + hip.w - 14},250
    Q ${hip.x + hip.w + 2},250 ${hip.x + hip.w + 8},238
    Q ${hip.x + hip.w + 10},222 ${hip.x + hip.w + 2},208 Z"/>

  <!-- HAMSTRINGS — biceps femoris + semitendinosus -->
  <path data-muscle="hamstrings" d="
    M 58,254 Q 66,246 78,248 Q 88,254 88,274
    Q 88,298 84,322 Q 80,338 72,340
    Q 60,338 54,320 Q 48,300 50,274 Q 52,260 58,254 Z"/>
  <path data-muscle="hamstrings" d="
    M 142,254 Q 134,246 122,248 Q 112,254 112,274
    Q 112,298 116,322 Q 120,338 128,340
    Q 140,338 146,320 Q 152,300 150,274 Q 148,260 142,254 Z"/>

  <!-- CALVES — gastrocnemius, back of lower leg -->
  <path data-muscle="calves" d="
    M 62,346 Q 70,336 79,340 Q 88,348 88,372
    Q 88,394 80,402 Q 72,404 66,396
    Q 58,384 58,364 Q 58,354 62,346 Z"/>
  <path data-muscle="calves" d="
    M 138,346 Q 130,336 121,340 Q 112,348 112,372
    Q 112,394 120,402 Q 128,404 134,396
    Q 142,384 142,364 Q 142,354 138,346 Z"/>

</svg>

<script>
  function setView(v){
    document.getElementById('svg-front').style.display=v==='front'?'block':'none';
    document.getElementById('svg-back').style.display=v==='back'?'block':'none';
    document.getElementById('btn-front').className='tb'+(v==='front'?' on':'');
    document.getElementById('btn-back').className='tb'+(v==='back'?' on':'');
  }
  function updateMuscles(muscles){
    document.querySelectorAll('[data-muscle]').forEach(function(el){
      el.className.baseVal=muscles.indexOf(el.getAttribute('data-muscle'))>=0?'active':'inactive';
    });
  }
  // Init all inactive on load
  document.querySelectorAll('[data-muscle]').forEach(function(el){
    el.className.baseVal='inactive';
  });
</script>
</body>
</html>`;
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function BodyDiagram({ sex = 'male', activeMuscles = new Set() }) {
  const webRef = useRef(null);

  // Push muscle state into the WebView whenever selection changes
  useEffect(() => {
    if (webRef.current) {
      const list = JSON.stringify(Array.from(activeMuscles));
      webRef.current.injectJavaScript(`updateMuscles(${list});true;`);
    }
  }, [activeMuscles]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        source={{ html: buildHTML(sex) }}
        style={styles.webview}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        backgroundColor="transparent"
        originWhitelist={['*']}
        // Prevent the WebView's own scroll from interfering with the parent
        overScrollMode="never"
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 190,
    height: 420,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
