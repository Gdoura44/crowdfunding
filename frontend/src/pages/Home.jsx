import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import {
  Loader2, BarChart3, MessageSquare, Scale, ShieldAlert, ClipboardList, Route, Bell, Lock, Eye,
  ShieldHalf, MailCheck, RotateCcw, AlertTriangle, ClipboardCheck, Settings, FileCheck, Rocket, BookOpen, UserCheck, ListChecks, UserCircle, Layers, Search, Wand2, Landmark, Flag, Compass, LogIn, UserPlus, RefreshCw, UserX, Headset, FileSignature, HelpingHand
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

function useHomeMode(loading, isAuthenticated, user) {
  if (loading) return "loading";
  if (!isAuthenticated) return "guest";
  if (user?.role === "ADMIN") return "admin";
  if (user?.role === "EXPERT") return "expert";
  return "member";
}

const BadgeItem = ({ icon: Icon, text }) => (
  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border border-primary/20 bg-primary/8 text-primary shadow-sm">
    <Icon className="h-3.5 w-3.5" />
    {text}
  </span>
);

const InfoCard = ({ icon: Icon, title, children }) => (
  <div className="p-5 rounded-xl border border-border/50 bg-card h-full transition-all hover:shadow-md hover:border-primary/20 group">
    <div className="font-semibold text-foreground mb-2 flex items-center gap-2">
      <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      {title}
    </div>
    <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
  </div>
);

const ActionCard = ({ icon: Icon, title, link, linkText, text }) => (
  <div className="p-5 rounded-xl border border-border/50 bg-card h-full transition-all hover:shadow-md hover:border-primary/20 group">
    <div className="font-semibold text-foreground mb-2 flex items-center gap-2">
      <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      {link ? (
        <Link to={link} className="hover:text-primary transition-colors">{linkText || title}</Link>
      ) : title}
    </div>
    <div className="text-sm text-muted-foreground leading-relaxed">{text}</div>
  </div>
);

const FeatureCard = ({ icon: Icon, title, text }) => (
  <Card className="h-full border-border/50 bg-card group hover:border-primary/25 transition-all duration-300">
    <CardContent className="p-6">
      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/15 to-[oklch(0.60_0.11_210)]/10 flex items-center justify-center mb-4 group-hover:from-primary/25 group-hover:to-[oklch(0.60_0.11_210)]/20 transition-all duration-300">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h2 className="text-sm font-bold uppercase tracking-wider text-primary/70 mb-3">{title}</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
    </CardContent>
  </Card>
);

const StepItem = ({ num, title, text }) => (
  <div className="flex gap-4 group">
    <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-primary to-[oklch(0.60_0.11_210)] text-white font-bold text-sm shadow-sm">
      {num}
    </div>
    <div className="pt-1">
      <div className="font-semibold text-foreground mb-1">{title}</div>
      <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
    </div>
  </div>
);

const PolicyItem = ({ icon: Icon, title, text }) => (
  <div className="flex gap-4 group">
    <div className="flex-shrink-0 mt-0.5">
      <div className="p-2 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
        <Icon className="h-5 w-5 text-primary" />
      </div>
    </div>
    <div>
      <div className="font-semibold text-foreground mb-1">{title}</div>
      <div className="text-sm text-muted-foreground leading-relaxed">{text}</div>
    </div>
  </div>
);

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const homeMode = useHomeMode(loading, isAuthenticated, user);

  return (
    <div className="space-y-12 pb-12">
      {/* HERO SECTION */}
      <section className="py-10 md:py-16 border-b border-border/40 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-primary/10 to-[oklch(0.60_0.11_210)]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border border-primary/25 bg-primary/8 text-primary mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Financement collaboratif
          </span>

        {homeMode === "loading" ? (
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">FinCollab</h1>
            <p className="text-xl text-muted-foreground mb-8">Chargement de votre session…</p>
            <div className="flex flex-wrap gap-3">
              <BadgeItem icon={Loader2} text="Veuillez patienter" />
            </div>
          </div>
        ) : homeMode === "expert" ? (
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Espace expert en <span className="fc-gradient-text">analyse financière</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Vous êtes chargé de valider les analyses IA des projets soumis à la revue et de répondre aux demandes de consultation des investisseurs significatifs. Vos décisions sont tracées et notifiées aux créateurs.
            </p>
            <div className="flex flex-wrap gap-3">
              <BadgeItem icon={BarChart3} text="Analyse de risque" />
              <BadgeItem icon={MessageSquare} text="Consultation investisseurs" />
              <BadgeItem icon={Scale} text="Décisions tracées" />
            </div>
          </div>
        ) : homeMode === "admin" ? (
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Pilotage et <span className="fc-gradient-text">conformité</span> de la plateforme
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Vous disposez d'outils de modération, de gestion des comptes et des opérations sensibles (versements, relances). Les actions à risque sont enregistrées pour audit et responsabilité partagée.
            </p>
            <div className="flex flex-wrap gap-3">
              <BadgeItem icon={Scale} text="Décisions tracées" />
              <BadgeItem icon={ShieldAlert} text="Gouvernance des accès" />
              <BadgeItem icon={ClipboardList} text="Traitement structuré des dossiers" />
            </div>
          </div>
        ) : homeMode === "member" ? (
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Votre espace <span className="fc-gradient-text">collaboratif</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Créez ou soutenez des campagnes : chaque étape est expliquée, les statuts sont visibles et les messages importants arrivent dans vos notifications. Le soutien n’est pas un placement financier : aucun rendement n’est garanti.
            </p>
            <div className="flex flex-wrap gap-3">
              <BadgeItem icon={Route} text="Parcours guidé" />
              <BadgeItem icon={Bell} text="Notifications à chaque étape" />
              <BadgeItem icon={Lock} text="Données sensibles protégées" />
            </div>
          </div>
        ) : (
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Transparence sur les <span className="fc-gradient-text">campagnes publiques</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Consultez gratuitement le catalogue des projets publiés (objectifs, dates, statut). Pour créer une campagne ou contribuer, une inscription avec vérification de l’e-mail est requise — afin de sécuriser les engagements et les paiements.
            </p>
            <div className="flex flex-wrap gap-3">
              <BadgeItem icon={Eye} text="Lecture du catalogue sans compte" />
              <BadgeItem icon={ShieldHalf} text="Modération avant publication" />
              <BadgeItem icon={MailCheck} text="Compte vérifié pour agir" />
            </div>
          </div>
        )}
        </div>{/* end .relative */}
      </section>

      {/* CONTRIBUTION WARNING (Guest & Member) */}
      {(homeMode === "guest" || homeMode === "member") && (
        <Card className="border-l-4 border-l-primary border-border/50 bg-card overflow-hidden">
          <CardContent className="p-6 md:p-8">
            <h2 className="text-xl font-bold text-foreground mb-3">
              {homeMode === "guest" ? "Comprendre le soutien sur FinCollab" : "Avant de contribuer"}
            </h2>
            <p className="text-muted-foreground mb-6 max-w-4xl">
              FinCollab est une plateforme de <strong>financement collaboratif</strong> orientée <strong>soutien</strong> (don / contribution). <strong>Ce n’est pas un placement financier</strong> et aucun rendement n’est garanti.
              {homeMode === "guest" && " En tant que visiteur, vous lisez les informations publiques ; aucune donnée bancaire ni engagement financier ne vous est demandé tant que vous n’avez pas de compte vérifié."}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InfoCard icon={Scale} title="Transparence">
                Les campagnes publiées sont décrites et suivies par des statuts lisibles ; les brouillons restent privés.
              </InfoCard>
              <InfoCard icon={RotateCcw} title="Annulation / remboursements">
                Selon les règles de la plateforme : fenêtre d’annulation lorsque c’est prévu, sur-financement ou projet expiré.
              </InfoCard>
              <InfoCard icon={AlertTriangle} title="Risques">
                Une initiative peut changer d’échéance ou ne pas atteindre son objectif. Le soutien reste un engagement informé.
              </InfoCard>
            </div>
          </CardContent>
        </Card>
      )}

      {/* THREE FEATURE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {homeMode === "expert" ? (
          <>
            <FeatureCard icon={BarChart3} title="Validation des analyses IA" text="Examiner les rapports générés par l'IA pour les projets en attente de revue. Approuver ou annuler l'analyse ; la publication reste réservée à l'administrateur." />
            <FeatureCard icon={MessageSquare} title="Consultations investisseurs" text="Répondre aux demandes des investisseurs ayant engagé ≥ 25 % de l'objectif d'un projet. Échange privé et clôture de dossier à votre initiative." />
            <FeatureCard icon={FileCheck} title="Traçabilité & notifications" text="Chaque décision est journalisée (audit) et notifiée au créateur. Les notifications rassemblent vos alertes expert en temps réel." />
          </>
        ) : homeMode === "admin" ? (
          <>
            <FeatureCard icon={ClipboardCheck} title="Modération & arbitrage" text="Examiner les projets, statuts, signalements et commentaires ; décider des publications, suspensions ou suites conformément aux règles internes." />
            <FeatureCard icon={Settings} title="Opérations & usagers" text="Gérer les comptes, les versements (payouts), les relances techniques et les demandes nécessitant une action Ops." />
            <FeatureCard icon={FileCheck} title="Traçabilité & notifications" text="Les notifications admin et le journal d’audit documentent les actions sensibles pour relecture et responsabilité." />
          </>
        ) : homeMode === "member" ? (
          <>
            <FeatureCard icon={Eye} title="Catalogue public" text="Parcourez les campagnes publiées : objectifs, dates et état. Les projets non encore publics restent invisibles pour les autres." />
            <FeatureCard icon={Rocket} title="Vos projets" text="Brouillon, analyse automatique, revue administrateur : vous suivez l’avancement et recevez une notification à chaque étape décisive." />
            <FeatureCard icon={Lock} title="Droits & données" text="Profil, préférences, investissements et payouts : l’accès est limité à votre compte ; les données sensibles sont protégées côté serveur." />
          </>
        ) : (
          <>
            <FeatureCard icon={BookOpen} title="Consulter sans compte" text={<><Link to="/projects" className="text-primary hover:underline">Explorer</Link> les fiches publiques : montants collectés, dates, catégorie. Aucune inscription n’est obligatoire pour la simple lecture.</>} />
            <FeatureCard icon={UserCheck} title="Créer un compte pour agir" text="L’inscription et la vérification de l’e-mail sont nécessaires pour créer une campagne, soutenir un projet ou déposer un signalement suiv." />
            <FeatureCard icon={Scale} title="Cadre commun" text="Les mêmes règles de modération et de transparence s’appliquent à tous ; les contributeurs signés bénéficient des politiques d’annulation et de remboursement prévues par la plateforme." />
          </>
        )}
      </div>

      {/* DASHBOARD LINKS */}
      {!loading && (
        <Card className="border-border/50 bg-card">
          <CardContent className="p-6 md:p-8">
            {homeMode === "expert" ? (
              <>
                <h2 className="text-2xl font-bold text-foreground mb-3">Fonctions réservées à l'expert</h2>
                <p className="text-muted-foreground mb-6 max-w-4xl">
                  Votre périmètre : valider les analyses IA des projets en revue et répondre aux consultations des investisseurs. Vous ne disposez pas des fonctions de publication (réservées à l'admin).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ActionCard icon={ListChecks} title="Menu Expert" link="/expert/projects" linkText="Dossiers à analyser" text="Consultez les projets en attente et rendez votre verdict (valider / annuler)." />
                  <ActionCard icon={MessageSquare} title="Consultations" link="/expert/consultations" text="Répondez aux demandes des investisseurs et clôturez les dossiers traités." />
                  <ActionCard icon={Bell} title="Notifications" link="/notifications" text="Alertes liées aux nouveaux dossiers et aux réponses des investisseurs." />
                  <ActionCard icon={UserCircle} title="Profil" link="/profile" text="Gérez vos informations personnelles et préférences de compte." />
                </div>
              </>
            ) : homeMode === "admin" ? (
              <>
                <h2 className="text-2xl font-bold text-foreground mb-3">Fonctions réservées aux administrateurs</h2>
                <p className="text-muted-foreground mb-6 max-w-4xl">
                  Les contributeurs et créateurs utilisent les menus « Mes projets », « Mes investissements », etc. Votre périmètre couvre la validation des campagnes, la gestion des comptes et signalements, les versements et les opérations techniques. Les actions sensibles laissent une trace dans l’audit.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ActionCard icon={ListChecks} title="Menu Admin" text="Accédez aux écrans Projets, Utilisateurs, Signalements, Commentaires, Payouts et Ops depuis la barre de navigation." />
                  <ActionCard icon={Bell} title="Notifications administration" text="Les alertes liées aux dossiers à traiter sont regroupées dans les notifications dédiées administrateur." />
                </div>
              </>
            ) : homeMode === "member" ? (
              <>
                <h2 className="text-2xl font-bold text-foreground mb-3">Accès rapide à votre compte</h2>
                <p className="text-muted-foreground mb-6 max-w-4xl">
                  Toutes les actions utiles sont dans le menu : projets, catalogue, soutiens, recommandations, versements (créateurs), signalements et profil. Les opérations sensibles sont journalisées.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <ActionCard icon={Layers} title="Mes projets" link="/dashboard" text="Tableau de bord : brouillons, analyse automatique, revue, puis publication." />
                  <ActionCard icon={Search} title="Explorer & contribuer" link="/projects" text={<>Catalogue puis fiche projet ; historique dans <Link to="/investments" className="text-primary hover:underline">Mes investissements</Link>.</>} />
                  <ActionCard icon={Bell} title="Notifications" link="/notifications" text="Délais, validations et mises à jour importantes." />
                  <ActionCard icon={Wand2} title="Recommandations" link="/recommendations" text={<>Suggestions basées sur votre <Link to="/profile" className="text-primary hover:underline">profil</Link> et des indicateurs de risque.</>} />
                  <ActionCard icon={Landmark} title="Mes payouts" link="/payouts" text="Demande de versement et coordonnées bancaires sécurisées." />
                  <ActionCard icon={Flag} title="Signalements" link="/reports" text="Dépôt depuis une fiche projet ; suivi dans le menu profil." />
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-foreground mb-3">Sans compte : ce que vous pouvez faire</h2>
                <p className="text-muted-foreground mb-6 max-w-4xl">
                  Vous pouvez parcourir les campagnes publiques et lire les informations affichées par les créateurs. Pour participer financièrement, signaler un contenu avec suivi, ou lancer une campagne, créez un compte et validez votre adresse e-mail.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ActionCard icon={Compass} title="Parcourir les campagnes" link="/projects" text="Objectifs, dates, statut : consultation libre et gratuite." />
                  <ActionCard icon={LogIn} title="Connexion" link="/login" text="Déjà un compte : retrouvez vos projets et vos soutiens." />
                  <ActionCard icon={UserPlus} title="Inscription" link="/register" text="Créer un compte vérifié pour contribuer ou publier." />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* HOW IT WORKS */}
      <Card className="border-border/50 bg-card">
        <CardContent className="p-6 md:p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {homeMode === "expert" ? "Organisation du travail expert"
                : homeMode === "admin" ? "Organisation du travail administrateur"
                : homeMode === "member" ? "Comment ça marche pour vous ?"
                : "Premiers pas sur la plateforme"}
            </h2>
            <p className="text-muted-foreground">
              {homeMode === "expert" ? "Ordre indicatif des responsabilités expert ; les écrans réels sont dans le menu Expert."
                : homeMode === "admin" ? "Ordre indicatif des responsabilités ; les écrans réels sont dans le menu Admin."
                : homeMode === "member" ? "Les statuts et notifications vous guident à chaque étape."
                : "Droit à l'information publique, puis inscription pour tout engagement."}
            </p>
          </div>

          <div className="flex flex-col space-y-6">
            {homeMode === "expert" ? (
              <>
                <StepItem num="1" title="Consulter les dossiers en attente" text="Accédez via « Dossiers à analyser » aux projets dont l'analyse IA est complète et attend votre validation." />
                <StepItem num="2" title="Valider ou annuler l'analyse" text="Examinez le rapport complet (score, niveau de risque, avantages, points faibles) puis choisissez « Approuver » ou « Annuler » avec un commentaire facultatif ou obligatoire." />
                <StepItem num="3" title="Répondre aux consultations investisseurs" text="Les investisseurs ayant engagé ≥ 25 % de l'objectif peuvent vous solliciter. Répondez dans le fil de discussion et clôturez le dossier une fois traité." />
              </>
            ) : homeMode === "admin" ? (
              <>
                <StepItem num="1" title="Prioriser les dossiers ouverts" text="Traiter les projets en attente de décision, les signalements ouverts et les demandes utilisateurs selon les procédures internes." />
                <StepItem num="2" title="Décider et documenter" text="Publier, rejeter, suspendre ou renvoyer pour correction ; les choix sensibles sont traçables pour contrôle ultérieur." />
                <StepItem num="3" title="Suivre opérations et versements" text="Superviser les payouts, relancer les opérations en échec si nécessaire, et tenir compte des alertes techniques (Ops)." />
              </>
            ) : homeMode === "member" ? (
              <>
                <StepItem num="1" title="Compte vérifié" text="L’adresse e-mail d’inscription doit être confirmée avant toute participation financière ou création de campagne." />
                <StepItem num="2" title="Campagne : soumission et validation" text="Analyse automatique (risque / cohérence), puis revue humaine. Vous recevez une notification à chaque changement de statut." />
                <StepItem num="3" title="Publication, soutien, suivi" text="Campagne visible dans le catalogue ; paiement depuis la fiche, historique dans Mes investissements, recommandations et notifications pour rester informé." />
              </>
            ) : (
              <>
                <StepItem num="1" title="Explorer le catalogue public" text="Consultez gratuitement les campagnes publiées et les informations que les créateurs rendent visibles (sans création de profil)." />
                <StepItem num="2" title="Créer un compte et confirmer l’e-mail" text="Nécessaire pour contribuer, créer une campagne ou ouvrir un signalement avec suivi. Vous acceptez alors les conditions d’usage et la politique de traitement des données applicables." />
                <StepItem num="3" title="Participer selon les mêmes règles pour tous" text="Modération des contenus, transparence sur les statuts, possibilités d’annulation ou de remboursement selon les cas prévus — voir la section Politiques ci-dessous une fois connecté pour le détail opérationnel." />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* POLICIES */}
      <Card className="border-border/50 bg-card">
        <CardContent className="p-6 md:p-8">
          <h2 className="text-2xl font-bold text-foreground mb-8">
            {homeMode === "expert" ? "Responsabilités et limites du rôle expert"
              : homeMode === "admin" ? "Responsabilités et limites du rôle administrateur"
              : homeMode === "member" ? "Politiques & droits des utilisateurs"
              : "Principes pour les visiteurs et futurs comptes"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {homeMode === "expert" ? (
              <>
                <PolicyItem icon={BarChart3} title="Analyse objective et documentée" text="Les décisions de validation doivent s'appuyer sur le rapport IA et les éléments fournis par le créateur. Tout commentaire de rejet doit être factuel et constructif." />
                <PolicyItem icon={MessageSquare} title="Confidentialité des échanges" text="Les consultations avec les investisseurs sont privées. Les données sensibles des projets et des investisseurs ne doivent pas être divulguées." />
                <PolicyItem icon={FileSignature} title="Traçabilité (audit)" text="Toutes vos décisions (validation / rejet) sont journalisées et accessibles à l'administrateur pour contrôle et responsabilité." />
                <PolicyItem icon={ShieldAlert} title="Pas de publication directe" text="Votre rôle se limite à la validation de l'analyse. Seul l'administrateur peut publier un projet approuvé et le rendre accessible au public." />
              </>
            ) : homeMode === "admin" ? (
              <>
                <PolicyItem icon={Scale} title="Impartialité et fondement documentaire" text="Les décisions de publication ou de sanction doivent reposer sur les éléments disponibles dans la plateforme et les règles communiquées aux utilisateurs." />
                <PolicyItem icon={UserX} title="Confidentialité des données usagers" text="Accédez uniquement aux informations nécessaires au traitement ; pas d’usage personnel des données sensibles (banques, pièces justificatives)." />
                <PolicyItem icon={FileSignature} title="Traçabilité (audit)" text="Les opérations sensibles sont journalisées : elles servent à la relecture, à la continuité de service et à l’explication auprès des parties concernées si besoin." />
                <PolicyItem icon={Headset} title="Coordination Ops" text="En cas d’échec technique (remboursement, versement), les outils Ops permettent de relancer ou d’analyser sans contourner les journaux de décision." />
              </>
            ) : homeMode === "member" ? (
              <>
                <PolicyItem icon={Scale} title="Transparence" text="Objectifs, dates et statuts affichés sur vos projets et campagnes soutenues ; notifications en cas de changement important." />
                <PolicyItem icon={ShieldAlert} title="Modération" text="Aucune campagne n’est publique sans passage par la revue. Les administrateurs peuvent suspendre ou exiger des corrections." />
                <PolicyItem icon={RefreshCw} title="Annulation & remboursements" text="Selon les cas (fenêtre prévue, sur-financement, expiration), des remboursements peuvent être déclenchés automatiquement, avec relance possible côté Ops si une étape échoue." />
                <PolicyItem icon={Lock} title="Données personnelles" text="Contrôle de votre profil et de vos préférences (y compris recommandations). Coordonnées bancaires liées aux payouts : stockage chiffré côté serveur." />
                <PolicyItem icon={Flag} title="Signalements" text="Vous pouvez signaler une campagne ; l’administration examine le dossier et peut clôturer avec ou sans suite, avec traçabilité." />
                <PolicyItem icon={HelpingHand} title="Information compréhensible" text="Droits à des statuts et messages compréhensibles ; en cas de blocage, une raison ou une prochaine étape doit être identifiable dans l’interface." />
              </>
            ) : (
              <>
                <PolicyItem icon={Eye} title="Lecture publique" text="Sans compte, vous bénéficiez de l’affichage des informations que les créateurs rendent publics (objectifs, dates, texte de présentation selon modération)." />
                <PolicyItem icon={ShieldAlert} title="Pas de droit au même traitement qu’un compte" text="Contribution financière, retraits créateurs, signalements avec suivi et messagerie d’notifications : réservés aux utilisateurs enregistrés et vérifiés." />
                <PolicyItem icon={ShieldHalf} title="Protection des futurs comptes" text="L’inscription permet d’appliquer la politique de confidentialité et de sécuriser les paiements ; tant que vous n’êtes pas inscrit, aucune donnée de carte ni d’engagement n’est collecté sur vous." />
                <PolicyItem icon={Scale} title="Règles communes après inscription" text="Une fois connecté, les mêmes règles de transparence, modération et annulation/remboursement s’appliquent (détails dans les écrans « Politiques » lorsque vous utilisez les services payants)." />
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
