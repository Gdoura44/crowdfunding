import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

/**
 * homeMode : guest (visiteur) | member (connecté hors admin) | admin
 * Pendant le chargement de la session, on évite d’afficher un contenu « admin » ou « membre » à tort.
 */
function useHomeMode(loading, isAuthenticated, user) {
  if (loading) return "loading";
  if (!isAuthenticated) return "guest";
  if (user?.role === "ADMIN") return "admin";
  return "member";
}

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const homeMode = useHomeMode(loading, isAuthenticated, user);
  const isAdmin = user?.role === "ADMIN";

  return (
    <div>
      {/* --- Hero : selon le rôle --- */}
      <section className="hero-section">
        <p className="small text-uppercase fw-semibold mb-2 opacity-90 letter-spacing-wide">
          Financement collaboratif
        </p>

        {homeMode === "loading" ? (
          <>
            <h1 className="display-6 display-md-4 mb-3">FinCollab</h1>
            <p className="lead mb-4">Chargement de votre session…</p>
            <div className="d-flex flex-wrap gap-2">
              <span className="badge bg-light text-dark border">
                <i className="fa-solid fa-spinner fa-spin me-2" aria-hidden="true" />
                Veuillez patienter
              </span>
            </div>
          </>
        ) : homeMode === "admin" ? (
          <>
            <h1 className="display-6 display-md-4 mb-3">Pilotage et conformité de la plateforme</h1>
            <p className="lead mb-4">
              Vous disposez d’outils de modération, de gestion des comptes et des opérations sensibles (versements,
              relances). Les actions à risque sont enregistrées pour audit et responsabilité partagée.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <span className="badge bg-light text-dark border">
                <i className="fa-solid fa-gavel me-2" aria-hidden="true" />
                Décisions tracées
              </span>
              <span className="badge bg-light text-dark border">
                <i className="fa-solid fa-user-shield me-2" aria-hidden="true" />
                Gouvernance des accès
              </span>
              <span className="badge bg-light text-dark border">
                <i className="fa-solid fa-clipboard-list me-2" aria-hidden="true" />
                Traitement structuré des dossiers
              </span>
            </div>
          </>
        ) : homeMode === "member" ? (
          <>
            <h1 className="display-6 display-md-4 mb-3">Votre espace collaboratif</h1>
            <p className="lead mb-4">
              Créez ou soutenez des campagnes : chaque étape est expliquée, les statuts sont visibles et les messages
              importants arrivent dans vos notifications. Le soutien n’est pas un placement financier : aucun rendement
              n’est garanti.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <span className="badge bg-light text-dark border">
                <i className="fa-solid fa-route me-2" aria-hidden="true" />
                Parcours guidé
              </span>
              <span className="badge bg-light text-dark border">
                <i className="fa-regular fa-bell me-2" aria-hidden="true" />
                Notifications à chaque étape
              </span>
              <span className="badge bg-light text-dark border">
                <i className="fa-solid fa-lock me-2" aria-hidden="true" />
                Données sensibles protégées
              </span>
            </div>
          </>
        ) : (
          <>
            <h1 className="display-6 display-md-4 mb-3">Transparence sur les campagnes publiques</h1>
            <p className="lead mb-4">
              Consultez gratuitement le catalogue des projets publiés (objectifs, dates, statut). Pour créer une
              campagne ou contribuer, une inscription avec vérification de l’e-mail est requise — afin de sécuriser les
              engagements et les paiements.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <span className="badge bg-light text-dark border">
                <i className="fa-solid fa-eye me-2" aria-hidden="true" />
                Lecture du catalogue sans compte
              </span>
              <span className="badge bg-light text-dark border">
                <i className="fa-solid fa-shield-halved me-2" aria-hidden="true" />
                Modération avant publication
              </span>
              <span className="badge bg-light text-dark border">
                <i className="fa-solid fa-envelope-circle-check me-2" aria-hidden="true" />
                Compte vérifié pour agir
              </span>
            </div>
          </>
        )}
      </section>

      {/* --- Bloc contribution : visiteur ou membre uniquement (pas pendant le chargement ni pour admin) --- */}
      {(homeMode === "guest" || homeMode === "member") && (
        <div className="card border-0 fc-surface-card mb-5">
          <div className="card-body p-4 p-md-5">
            <h2 className="h5 mb-2 fw-bold text-dark">
              {homeMode === "guest" ? "Comprendre le soutien sur FinCollab" : "Avant de contribuer"}
            </h2>
            <p className="text-muted small mb-3">
              FinCollab est une plateforme de <strong>financement collaboratif</strong> orientée{" "}
              <strong>soutien</strong> (don / contribution). <strong>Ce n’est pas un placement financier</strong> et
              aucun rendement n’est garanti.
              {homeMode === "guest" && (
                <>
                  {" "}
                  En tant que visiteur, vous lisez les informations publiques ; aucune donnée bancaire ni engagement
                  financier ne vous est demandé tant que vous n’avez pas de compte vérifié.
                </>
              )}
            </p>
            <div className="row g-3 small">
              <div className="col-md-4">
                <div className="p-3 rounded-3 border bg-light h-100">
                  <div className="fw-semibold mb-1">
                    <i className="fa-solid fa-scale-balanced me-2 text-primary" aria-hidden="true" />
                    Transparence
                  </div>
                  <div className="text-muted">
                    Les campagnes publiées sont décrites et suivies par des statuts lisibles ; les brouillons restent
                    privés.
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="p-3 rounded-3 border bg-light h-100">
                  <div className="fw-semibold mb-1">
                    <i className="fa-solid fa-rotate-left me-2 text-primary" aria-hidden="true" />
                    Annulation / remboursements
                  </div>
                  <div className="text-muted">
                    Selon les règles de la plateforme : fenêtre d’annulation lorsque c’est prévu, sur-financement ou
                    projet expiré.
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="p-3 rounded-3 border bg-light h-100">
                  <div className="fw-semibold mb-1">
                    <i className="fa-solid fa-triangle-exclamation me-2 text-primary" aria-hidden="true" />
                    Risques
                  </div>
                  <div className="text-muted">
                    Une initiative peut changer d’échéance ou ne pas atteindre son objectif. Le soutien reste un
                    engagement informé.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Trois cartes : aperçu plateforme selon le rôle --- */}
      <div className="row g-4 mb-5">
        {homeMode === "admin" ? (
          <>
            <div className="col-md-4">
              <div className="card h-100 border-0 fc-surface-card">
                <div className="card-body p-4">
                  <div className="fc-feature-icon mb-3">
                    <i className="fa-solid fa-clipboard-check" aria-hidden="true" />
                  </div>
                  <h2 className="h6 text-uppercase text-muted mb-2 letter-spacing-wide">
                    Modération & arbitrage
                  </h2>
                  <p className="small text-muted mb-0">
                    Examiner les projets, statuts, signalements et commentaires ; décider des publications, suspensions
                    ou suites conformément aux règles internes.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100 border-0 fc-surface-card">
                <div className="card-body p-4">
                  <div className="fc-feature-icon mb-3">
                    <i className="fa-solid fa-gears" aria-hidden="true" />
                  </div>
                  <h2 className="h6 text-uppercase text-muted mb-2 letter-spacing-wide">
                    Opérations & usagers
                  </h2>
                  <p className="small text-muted mb-0">
                    Gérer les comptes, les versements (payouts), les relances techniques et les demandes nécessitant une
                    action Ops.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100 border-0 fc-surface-card">
                <div className="card-body p-4">
                  <div className="fc-feature-icon mb-3">
                    <i className="fa-solid fa-file-shield" aria-hidden="true" />
                  </div>
                  <h2 className="h6 text-uppercase text-muted mb-2 letter-spacing-wide">
                    Traçabilité & notifications
                  </h2>
                  <p className="small text-muted mb-0">
                    Les notifications admin et le journal d’audit documentent les actions sensibles pour relecture et
                    responsabilité.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : homeMode === "member" ? (
          <>
            <div className="col-md-4">
              <div className="card h-100 border-0 fc-surface-card">
                <div className="card-body p-4">
                  <div className="fc-feature-icon mb-3">
                    <i className="fa-solid fa-eye" aria-hidden="true" />
                  </div>
                  <h2 className="h6 text-uppercase text-muted mb-2 letter-spacing-wide">
                    Catalogue public
                  </h2>
                  <p className="small text-muted mb-0">
                    Parcourez les campagnes publiées : objectifs, dates et état. Les projets non encore publics restent
                    invisibles pour les autres.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100 border-0 fc-surface-card">
                <div className="card-body p-4">
                  <div className="fc-feature-icon mb-3">
                    <i className="fa-solid fa-rocket" aria-hidden="true" />
                  </div>
                  <h2 className="h6 text-uppercase text-muted mb-2 letter-spacing-wide">
                    Vos projets
                  </h2>
                  <p className="small text-muted mb-0">
                    Brouillon, analyse automatique, revue administrateur : vous suivez l’avancement et recevez une
                    notification à chaque étape décisive.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100 border-0 fc-surface-card">
                <div className="card-body p-4">
                  <div className="fc-feature-icon mb-3">
                    <i className="fa-solid fa-lock" aria-hidden="true" />
                  </div>
                  <h2 className="h6 text-uppercase text-muted mb-2 letter-spacing-wide">
                    Droits & données
                  </h2>
                  <p className="small text-muted mb-0">
                    Profil, préférences, investissements et payouts : l’accès est limité à votre compte ; les données
                    sensibles sont protégées côté serveur.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="col-md-4">
              <div className="card h-100 border-0 fc-surface-card">
                <div className="card-body p-4">
                  <div className="fc-feature-icon mb-3">
                    <i className="fa-solid fa-book-open" aria-hidden="true" />
                  </div>
                  <h2 className="h6 text-uppercase text-muted mb-2 letter-spacing-wide">
                    Consulter sans compte
                  </h2>
                  <p className="small text-muted mb-0">
                    <Link to="/projects" className="text-decoration-none">
                      Explorer
                    </Link>{" "}
                    les fiches publiques : montants collectés, dates, catégorie. Aucune inscription n’est obligatoire pour
                    la simple lecture.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100 border-0 fc-surface-card">
                <div className="card-body p-4">
                  <div className="fc-feature-icon mb-3">
                    <i className="fa-solid fa-user-check" aria-hidden="true" />
                  </div>
                  <h2 className="h6 text-uppercase text-muted mb-2 letter-spacing-wide">
                    Créer un compte pour agir
                  </h2>
                  <p className="small text-muted mb-0">
                    L’inscription et la vérification de l’e-mail sont nécessaires pour créer une campagne, soutenir un
                    projet ou déposer un signalement suiv.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100 border-0 fc-surface-card">
                <div className="card-body p-4">
                  <div className="fc-feature-icon mb-3">
                    <i className="fa-solid fa-scale-balanced" aria-hidden="true" />
                  </div>
                  <h2 className="h6 text-uppercase text-muted mb-2 letter-spacing-wide">
                    Cadre commun
                  </h2>
                  <p className="small text-muted mb-0">
                    Les mêmes règles de modération et de transparence s’appliquent à tous ; les contributeurs signés
                    bénéficient des politiques d’annulation et de remboursement prévues par la plateforme.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* --- Feuille de route personnelle (jamais de bloc « admin » pour un visiteur) --- */}
      {!loading && (
        <section className="card border-0 fc-surface-card mb-5">
          <div className="card-body p-4 p-md-5">
            {homeMode === "admin" ? (
              <>
                <h2 className="h5 mb-2 fw-bold text-dark">Fonctions réservées aux administrateurs</h2>
                <p className="text-muted small mb-4">
                  Les contributeurs et créateurs utilisent les menus « Mes projets », « Mes investissements », etc. Votre
                  périmètre couvre la validation des campagnes, la gestion des comptes et signalements, les versements
                  et les opérations techniques. Les actions sensibles laissent une trace dans l’audit.
                </p>
                <div className="row g-3 small">
                  <div className="col-md-6">
                    <div className="p-3 rounded-3 border bg-light h-100">
                      <div className="fw-semibold text-dark mb-1">
                        <i className="fa-solid fa-list-check me-2 text-primary" aria-hidden="true" />
                        Menu Admin
                      </div>
                      <div className="text-muted mb-0">
                        Accédez aux écrans Projets, Utilisateurs, Signalements, Commentaires, Payouts et Ops depuis la
                        barre de navigation.
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="p-3 rounded-3 border bg-light h-100">
                      <div className="fw-semibold text-dark mb-1">
                        <i className="fa-regular fa-bell me-2 text-primary" aria-hidden="true" />
                        Notifications administration
                      </div>
                      <div className="text-muted mb-0">
                        Les alertes liées aux dossiers à traiter sont regroupées dans les notifications dédiées
                        administrateur.
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : homeMode === "member" ? (
              <>
                <h2 className="h5 mb-2 fw-bold text-dark">Accès rapide à votre compte</h2>
                <p className="text-muted small mb-4">
                  Toutes les actions utiles sont dans le menu : projets, catalogue, soutiens, recommandations, versements
                  (créateurs), signalements et profil. Les opérations sensibles sont journalisées.
                </p>
                <div className="row g-3">
                  <div className="col-md-6 col-lg-4">
                    <div className="p-3 rounded-3 border bg-light h-100">
                      <div className="fw-semibold text-dark mb-1">
                        <i className="fa-solid fa-layer-group me-2 text-primary" aria-hidden="true" />
                        <Link to="/dashboard" className="text-dark text-decoration-none">
                          Mes projets
                        </Link>
                      </div>
                      <div className="small text-muted">
                        Tableau de bord : brouillons, analyse automatique, revue, puis publication.
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 col-lg-4">
                    <div className="p-3 rounded-3 border bg-light h-100">
                      <div className="fw-semibold text-dark mb-1">
                        <i className="fa-solid fa-magnifying-glass me-2 text-primary" aria-hidden="true" />
                        <Link to="/projects" className="text-dark text-decoration-none">
                          Explorer & contribuer
                        </Link>
                      </div>
                      <div className="small text-muted">
                        Catalogue puis fiche projet ; historique dans{" "}
                        <Link to="/investments" className="text-decoration-none">
                          Mes investissements
                        </Link>
                        .
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 col-lg-4">
                    <div className="p-3 rounded-3 border bg-light h-100">
                      <div className="fw-semibold text-dark mb-1">
                        <i className="fa-regular fa-bell me-2 text-primary" aria-hidden="true" />
                        <Link to="/notifications" className="text-dark text-decoration-none">
                          Notifications
                        </Link>
                      </div>
                      <div className="small text-muted">Délais, validations et mises à jour importantes.</div>
                    </div>
                  </div>
                  <div className="col-md-6 col-lg-4">
                    <div className="p-3 rounded-3 border bg-light h-100">
                      <div className="fw-semibold text-dark mb-1">
                        <i className="fa-solid fa-wand-magic-sparkles me-2 text-primary" aria-hidden="true" />
                        <Link to="/recommendations" className="text-dark text-decoration-none">
                          Recommandations
                        </Link>
                      </div>
                      <div className="small text-muted">
                        Suggestions basées sur votre{" "}
                        <Link to="/profile" className="text-decoration-none">
                          profil
                        </Link>{" "}
                        et des indicateurs de risque.
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 col-lg-4">
                    <div className="p-3 rounded-3 border bg-light h-100">
                      <div className="fw-semibold text-dark mb-1">
                        <i className="fa-solid fa-building-columns me-2 text-primary" aria-hidden="true" />
                        <Link to="/payouts" className="text-dark text-decoration-none">
                          Mes payouts
                        </Link>
                      </div>
                      <div className="small text-muted">Demande de versement et coordonnées bancaires sécurisées.</div>
                    </div>
                  </div>
                  <div className="col-md-6 col-lg-4">
                    <div className="p-3 rounded-3 border bg-light h-100">
                      <div className="fw-semibold text-dark mb-1">
                        <i className="fa-solid fa-flag me-2 text-primary" aria-hidden="true" />
                        <Link to="/reports" className="text-dark text-decoration-none">
                          Signalements
                        </Link>
                      </div>
                      <div className="small text-muted">Dépôt depuis une fiche projet ; suivi dans le menu profil.</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="h5 mb-2 fw-bold text-dark">Sans compte : ce que vous pouvez faire</h2>
                <p className="text-muted small mb-4">
                  Vous pouvez parcourir les campagnes publiques et lire les informations affichées par les créateurs. Pour
                  participer financièrement, signaler un contenu avec suivi, ou lancer une campagne, créez un compte et
                  validez votre adresse e-mail.
                </p>
                <div className="row g-3">
                  <div className="col-md-4">
                    <div className="p-3 rounded-3 border bg-light h-100">
                      <div className="fw-semibold text-dark mb-1">
                        <i className="fa-solid fa-compass me-2 text-primary" aria-hidden="true" />
                        <Link to="/projects" className="text-dark text-decoration-none">
                          Parcourir les campagnes
                        </Link>
                      </div>
                      <div className="small text-muted">Objectifs, dates, statut : consultation libre et gratuite.</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-3 rounded-3 border bg-light h-100">
                      <div className="fw-semibold text-dark mb-1">
                        <i className="fa-solid fa-right-to-bracket me-2 text-primary" aria-hidden="true" />
                        <Link to="/login" className="text-dark text-decoration-none">
                          Connexion
                        </Link>
                      </div>
                      <div className="small text-muted">Déjà un compte : retrouvez vos projets et vos soutiens.</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-3 rounded-3 border bg-light h-100">
                      <div className="fw-semibold text-dark mb-1">
                        <i className="fa-solid fa-user-plus me-2 text-primary" aria-hidden="true" />
                        <Link to="/register" className="text-dark text-decoration-none">
                          Inscription
                        </Link>
                      </div>
                      <div className="small text-muted">Créer un compte vérifié pour contribuer ou publier une campagne.</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* --- Comment ça marche : trois versions --- */}
      <section className="card border-0 fc-surface-card mb-5">
        <div className="card-body p-4 p-md-5">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
            <div>
              <h2 className="h5 mb-1 fw-bold text-dark">
                {homeMode === "admin"
                  ? "Organisation du travail administrateur"
                  : homeMode === "member"
                    ? "Comment ça marche pour vous ?"
                    : "Premiers pas sur la plateforme"}
              </h2>
              <p className="text-muted small mb-0">
                {homeMode === "admin"
                  ? "Ordre indicatif des responsabilités ; les écrans réels sont dans le menu Admin."
                  : homeMode === "member"
                    ? "Les statuts et notifications vous guident à chaque étape."
                    : "Droit à l’information publique, puis inscription pour tout engagement."}
              </p>
            </div>
          </div>

          <div className="vstack gap-4">
            {homeMode === "admin" ? (
              <>
                <div className="fc-step">
                  <span className="fc-step__num" aria-hidden="true">
                    1
                  </span>
                  <div>
                    <div className="fw-semibold text-dark mb-1">Prioriser les dossiers ouverts</div>
                    <p className="small text-muted mb-0">
                      Traiter les projets en attente de décision, les signalements ouverts et les demandes utilisateurs
                      selon les procédures internes.
                    </p>
                  </div>
                </div>
                <div className="fc-step">
                  <span className="fc-step__num" aria-hidden="true">
                    2
                  </span>
                  <div>
                    <div className="fw-semibold text-dark mb-1">Décider et documenter</div>
                    <p className="small text-muted mb-0">
                      Publier, rejeter, suspendre ou renvoyer pour correction ; les choix sensibles sont traçables pour
                      contrôle ultérieur.
                    </p>
                  </div>
                </div>
                <div className="fc-step">
                  <span className="fc-step__num" aria-hidden="true">
                    3
                  </span>
                  <div>
                    <div className="fw-semibold text-dark mb-1">Suivre opérations et versements</div>
                    <p className="small text-muted mb-0">
                      Superviser les payouts, relancer les opérations en échec si nécessaire, et tenir compte des
                      alertes techniques (Ops).
                    </p>
                  </div>
                </div>
              </>
            ) : homeMode === "member" ? (
              <>
                <div className="fc-step">
                  <span className="fc-step__num" aria-hidden="true">
                    1
                  </span>
                  <div>
                    <div className="fw-semibold text-dark mb-1">Compte vérifié</div>
                    <p className="small text-muted mb-0">
                      L’adresse e-mail d’inscription doit être confirmée avant toute participation financière ou création
                      de campagne.
                    </p>
                  </div>
                </div>
                <div className="fc-step">
                  <span className="fc-step__num" aria-hidden="true">
                    2
                  </span>
                  <div>
                    <div className="fw-semibold text-dark mb-1">Campagne : soumission et validation</div>
                    <p className="small text-muted mb-0">
                      Analyse automatique (risque / cohérence), puis revue humaine. Vous recevez une notification à
                      chaque changement de statut.
                    </p>
                  </div>
                </div>
                <div className="fc-step">
                  <span className="fc-step__num" aria-hidden="true">
                    3
                  </span>
                  <div>
                    <div className="fw-semibold text-dark mb-1">Publication, soutien, suivi</div>
                    <p className="small text-muted mb-0">
                      Campagne visible dans le catalogue ; paiement depuis la fiche, historique dans Mes investissements,
                      recommandations et notifications pour rester informé.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="fc-step">
                  <span className="fc-step__num" aria-hidden="true">
                    1
                  </span>
                  <div>
                    <div className="fw-semibold text-dark mb-1">Explorer le catalogue public</div>
                    <p className="small text-muted mb-0">
                      Consultez gratuitement les campagnes publiées et les informations que les créateurs rendent
                      visibles (sans création de profil).
                    </p>
                  </div>
                </div>
                <div className="fc-step">
                  <span className="fc-step__num" aria-hidden="true">
                    2
                  </span>
                  <div>
                    <div className="fw-semibold text-dark mb-1">Créer un compte et confirmer l’e-mail</div>
                    <p className="small text-muted mb-0">
                      Nécessaire pour contribuer, créer une campagne ou ouvrir un signalement avec suivi. Vous acceptez
                      alors les conditions d’usage et la politique de traitement des données applicables.
                    </p>
                  </div>
                </div>
                <div className="fc-step">
                  <span className="fc-step__num" aria-hidden="true">
                    3
                  </span>
                  <div>
                    <div className="fw-semibold text-dark mb-1">Participer selon les mêmes règles pour tous</div>
                    <p className="small text-muted mb-0">
                      Modération des contenus, transparence sur les statuts, possibilités d’annulation ou de
                      remboursement selon les cas prévus — voir la section Politiques ci-dessous une fois connecté pour
                      le détail opérationnel.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* --- Politiques : trois versions --- */}
      <section className="card border-0 fc-surface-card mb-5">
        <div className="card-body p-4 p-md-5">
          <h2 className="h5 mb-3 fw-bold text-dark">
            {homeMode === "admin"
              ? "Responsabilités et limites du rôle administrateur"
              : homeMode === "member"
                ? "Politiques & droits des utilisateurs"
                : "Principes pour les visiteurs et futurs comptes"}
          </h2>
          <div className="row g-4">
            {homeMode === "admin" ? (
              <>
                <div className="col-md-6">
                  <div className="d-flex gap-3">
                    <div className="fc-feature-icon">
                      <i className="fa-solid fa-balance-scale" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="fw-semibold text-dark mb-1">Impartialité et fondement documentaire</div>
                      <div className="small text-muted">
                        Les décisions de publication ou de sanction doivent reposer sur les éléments disponibles dans la
                        plateforme et les règles communiquées aux utilisateurs.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex gap-3">
                    <div className="fc-feature-icon">
                      <i className="fa-solid fa-user-lock" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="fw-semibold text-dark mb-1">Confidentialité des données usagers</div>
                      <div className="small text-muted">
                        Accédez uniquement aux informations nécessaires au traitement ; pas d’usage personnel des données
                        sensibles (banques, pièces justificatives).
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex gap-3">
                    <div className="fc-feature-icon">
                      <i className="fa-solid fa-file-signature" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="fw-semibold text-dark mb-1">Traçabilité (audit)</div>
                      <div className="small text-muted">
                        Les opérations sensibles sont journalisées : elles servent à la relecture, à la continuité de
                        service et à l’explication auprès des parties concernées si besoin.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex gap-3">
                    <div className="fc-feature-icon">
                      <i className="fa-solid fa-headset" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="fw-semibold text-dark mb-1">Coordination Ops</div>
                      <div className="small text-muted">
                        En cas d’échec technique (remboursement, versement), les outils Ops permettent de relancer ou
                        d’analyser sans contourner les journaux de décision.
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : homeMode === "member" ? (
              <>
                <div className="col-md-6">
                  <div className="d-flex gap-3">
                    <div className="fc-feature-icon">
                      <i className="fa-solid fa-scale-balanced" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="fw-semibold text-dark mb-1">Transparence</div>
                      <div className="small text-muted">
                        Objectifs, dates et statuts affichés sur vos projets et campagnes soutenues ; notifications en cas
                        de changement important.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex gap-3">
                    <div className="fc-feature-icon">
                      <i className="fa-solid fa-user-shield" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="fw-semibold text-dark mb-1">Modération</div>
                      <div className="small text-muted">
                        Aucune campagne n’est publique sans passage par la revue. Les administrateurs peuvent suspendre ou
                        exiger des corrections.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex gap-3">
                    <div className="fc-feature-icon">
                      <i className="fa-solid fa-rotate" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="fw-semibold text-dark mb-1">Annulation & remboursements</div>
                      <div className="small text-muted">
                        Selon les cas (fenêtre prévue, sur-financement, expiration), des remboursements peuvent être
                        déclenchés automatiquement, avec relance possible côté Ops si une étape échoue.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex gap-3">
                    <div className="fc-feature-icon">
                      <i className="fa-solid fa-lock" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="fw-semibold text-dark mb-1">Données personnelles</div>
                      <div className="small text-muted">
                        Contrôle de votre profil et de vos préférences (y compris recommandations). Coordonnées bancaires
                        liées aux payouts : stockage chiffré côté serveur.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex gap-3">
                    <div className="fc-feature-icon">
                      <i className="fa-solid fa-flag" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="fw-semibold text-dark mb-1">Signalements</div>
                      <div className="small text-muted">
                        Vous pouvez signaler une campagne ; l’administration examine le dossier et peut clôturer avec ou
                        sans suite, avec traçabilité.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex gap-3">
                    <div className="fc-feature-icon">
                      <i className="fa-solid fa-handshake-angle" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="fw-semibold text-dark mb-1">Information compréhensible</div>
                      <div className="small text-muted">
                        Droits à des statuts et messages compréhensibles ; en cas de blocage, une raison ou une prochaine
                        étape doit être identifiable dans l’interface.
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="col-md-6">
                  <div className="d-flex gap-3">
                    <div className="fc-feature-icon">
                      <i className="fa-solid fa-eye" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="fw-semibold text-dark mb-1">Lecture publique</div>
                      <div className="small text-muted">
                        Sans compte, vous bénéficiez de l’affichage des informations que les créateurs rendent publics
                        (objectifs, dates, texte de présentation selon modération).
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex gap-3">
                    <div className="fc-feature-icon">
                      <i className="fa-solid fa-ban" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="fw-semibold text-dark mb-1">Pas de droit au même traitement qu’un compte</div>
                      <div className="small text-muted">
                        Contribution financière, retraits créateurs, signalements avec suivi et messagerie
                        d’notifications : réservés aux utilisateurs enregistrés et vérifiés.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex gap-3">
                    <div className="fc-feature-icon">
                      <i className="fa-solid fa-shield-halved" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="fw-semibold text-dark mb-1">Protection des futurs comptes</div>
                      <div className="small text-muted">
                        L’inscription permet d’appliquer la politique de confidentialité et de sécuriser les paiements ;
                        tant que vous n’êtes pas inscrit, aucune donnée de carte ni d’engagement n’est collecté sur vous.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex gap-3">
                    <div className="fc-feature-icon">
                      <i className="fa-solid fa-scale-balanced" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="fw-semibold text-dark mb-1">Règles communes après inscription</div>
                      <div className="small text-muted">
                        Une fois connecté, les mêmes règles de transparence, modération et annulation/remboursement
                        s’appliquent (détails dans les écrans « Politiques » lorsque vous utilisez les services payants).
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
