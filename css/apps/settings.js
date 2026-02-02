/* css/apps/settings.css
   YamanOS v0.4 — Settings app styles
*/

.app-frame .settings,
.settings{
  height: 100%;
  width: 100%;
  overflow: auto;
  padding: 18px;
  box-sizing: border-box;
  color: var(--text);
}

.settings__loading{
  opacity: 0.8;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 12px;
}

.settings__header{
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.settings__title{
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.2px;
}

.settings__sub{
  font-size: 12px;
  color: var(--muted);
}

.settings__section{
  margin: 14px 0 18px;
}

.settings__sectionTitle{
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0 0 10px;
}

.settings__card{
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04));
  box-shadow: 0 16px 40px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10);
  backdrop-filter: blur(12px);
  padding: 14px;
}

.settings__row{
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 12px 6px;
}

.settings__row + .settings__row{
  border-top: 1px solid rgba(255,255,255,0.10);
}

.settings__label{
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.2px;
}

.settings__hint{
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.35;
}

.settings__select{
  appearance: none;
  border-radius: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(0,0,0,0.18);
  color: var(--text);
  outline: none;
  min-width: 220px;
}

:root[data-theme="light"] .settings__select{
  background: rgba(255,255,255,0.70);
  border-color: rgba(0,0,0,0.10);
}

.settings__toggle{
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.settings__toggle input{
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.settings__toggleUi{
  width: 52px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.16);
  background: rgba(0,0,0,0.22);
  position: relative;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06);
  transition: transform 160ms ease, background 160ms ease;
}

.settings__toggleUi::after{
  content: "";
  width: 24px;
  height: 24px;
  border-radius: 50%;
  position: absolute;
  left: 3px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.92);
  box-shadow: 0 10px 20px rgba(0,0,0,0.30);
  transition: left 160ms ease;
}

.settings__toggle input:checked + .settings__toggleUi{
  background: rgba(120,190,255,0.42);
}

.settings__toggle input:checked + .settings__toggleUi::after{
  left: 25px;
}

.settings__btnRow{
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 10px;
}

.settings__btn{
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.16);
  background: rgba(0,0,0,0.18);
  color: var(--text);
  padding: 10px 12px;
  font-weight: 800;
  letter-spacing: 0.2px;
  cursor: pointer;
  transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
}

.settings__btn:hover{ transform: translateY(-1px); }
.settings__btn:active{ transform: translateY(0px); }

.settings__btn--danger{
  border-color: rgba(255,120,120,0.22);
  background: rgba(255,80,80,0.10);
}

.settings__warn{
  font-size: 12px;
  color: var(--muted);
  line-height: 1.45;
  padding: 6px 6px 10px;
}

.settings__warn code{
  font-family: var(--mono);
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  background: rgba(0,0,0,0.22);
  border: 1px solid rgba(255,255,255,0.10);
}

.settings__footer{
  margin-top: 14px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
}
