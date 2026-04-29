import { useAuth } from "../hooks/useAuth.js";

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  void user;

  return (
    <div>
      <section className="hero-section">
        <p className="small text-uppercase fw-semibold mb-2 opacity-90 letter-spacing-wide">
          Financement collaboratif
        </p>
        <h1 className="display-6 display-md-4 mb-3">
          Transparence, confiance, et droits des utilisateurs
        </h1>
        <p className="lead mb-4">
          FinCollab est une plateforme de financement collaboratif conçue pour expliquer clairement
          chaque étape, encadrer les campagnes et protéger les utilisateurs : créateurs comme
          contributeurs.
        </p>
        <div className="d-flex flex-wrap gap-2">
          <span className="badge bg-light text-dark border">
            <i className="fa-solid fa-shield-halved me-2" aria-hidden="true" />
            Modération avant publication
          </span>
          <span className="badge bg-light text-dark border">
            <i className="fa-solid fa-bell me-2" aria-hidden="true" />
            Notifications à chaque étape
          </span>
          <span className="badge bg-light text-dark border">
            <i className="fa-solid fa-lock me-2" aria-hidden="true" />
            Données protégées
          </span>
        </div>
      </section>

      <div className="card border-0 fc-surface-card mb-5">
        <div className="card-body p-4 p-md-5">
          <h2 className="h5 mb-2 fw-bold text-dark">Avant de contribuer</h2>
          <p className="text-muted small mb-3">
            FinCollab est une plateforme de <strong>financement collaboratif</strong> orientée{" "}
            <strong>soutien</strong> (don / contribution).{" "}
            <strong>Ce n’est pas un placement financier</strong> et aucun rendement n’est garanti.
          </p>
          <div className="row g-3 small">
            <div className="col-md-4">
              <div className="p-3 rounded-3 border bg-light h-100">
                <div className="fw-semibold mb-1">
                  <i className="fa-solid fa-scale-balanced me-2 text-primary" aria-hidden="true" />
                  Transparence
                </div>
                <div className="text-muted">
                  Les campagnes sont décrites, modérées avant publication et suivies par des statuts lisibles.
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
                  Selon les cas : annulation dans une fenêtre (si applicable), sur‑financement, ou projet expiré.
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
                  Un projet peut rencontrer des retards ou ne pas aboutir. Les contributeurs soutiennent une initiative.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-5">
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
                Explorez les campagnes publiées : objectifs, dates et statut. Les brouillons et
                dossiers en revue restent privés.
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
                Parcours guidé
              </h2>
              <p className="small text-muted mb-0">
                Créez un brouillon, améliorez-le, puis soumettez. Les statuts restent lisibles et
                vous recevez des notifications à chaque étape.
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
                Droits & sécurité
              </h2>
              <p className="small text-muted mb-0">
                Contrôle d’accès par rôle, traçabilité, et protection des données. Les informations
                sensibles sont chiffrées côté serveur.
              </p>
            </div>
          </div>
        </div>
      </div>

      {!loading && (
        <section className="card border-0 fc-surface-card mb-5">
          <div className="card-body p-4 p-md-5">
            <h2 className="h5 mb-2 fw-bold text-dark">
              {isAuthenticated ? "Espace utilisateur : vos actions" : "Visiteurs : ce que vous pouvez faire"}
            </h2>
            <p className="text-muted small mb-4">
              {isAuthenticated
                ? "Vous utilisez la plateforme en tant que créateur ou contributeur. Vos démarches sont guidées et chaque étape est expliquée."
                : "Vous pouvez explorer les campagnes publiques. Pour créer une campagne ou contribuer, il suffit de se connecter."}{" "}
              <span className="text-muted">
                Pour la sécurité et la confidentialité, les actions sensibles sont tracées dans un journal (audit).
              </span>
            </p>

            {isAuthenticated && (
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="p-3 rounded-3 border bg-light">
                    <div className="fw-semibold text-dark mb-1">
                      <i className="fa-solid fa-circle-plus me-2 text-primary" aria-hidden="true" />
                      Créer un projet
                    </div>
                    <div className="small text-muted">
                      Brouillon → soumission → statut clair (analyse, revue, publication) avec notifications.
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3 rounded-3 border bg-light">
                    <div className="fw-semibold text-dark mb-1">
                      <i className="fa-solid fa-magnifying-glass me-2 text-primary" aria-hidden="true" />
                      Explorer et soutenir
                    </div>
                    <div className="small text-muted">
                      Consultez les campagnes publiques et contribuez via paiement simulé (flux réaliste sans argent réel).
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3 rounded-3 border bg-light">
                    <div className="fw-semibold text-dark mb-1">
                      <i className="fa-regular fa-bell me-2 text-primary" aria-hidden="true" />
                      Suivre les notifications
                    </div>
                    <div className="small text-muted">
                      Toutes les étapes importantes vous sont annoncées (décisions, changements, paiements).
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3 rounded-3 border bg-light">
                    <div className="fw-semibold text-dark mb-1">
                      <i className="fa-solid fa-flag me-2 text-primary" aria-hidden="true" />
                      Signaler un projet
                    </div>
                    <div className="small text-muted">
                      Vous pouvez signaler une campagne. L’administration traite et vous reçoit une réponse.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isAuthenticated && (
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="p-3 rounded-3 border bg-light">
                    <div className="fw-semibold text-dark mb-1">
                      <i className="fa-solid fa-compass me-2 text-primary" aria-hidden="true" />
                      Explorer le catalogue public
                    </div>
                    <div className="small text-muted">
                      Voir les campagnes publiées, leurs objectifs, dates et statuts, sans compte.
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3 rounded-3 border bg-light">
                    <div className="fw-semibold text-dark mb-1">
                      <i className="fa-solid fa-user-plus me-2 text-primary" aria-hidden="true" />
                      Créer un compte
                    </div>
                    <div className="small text-muted">
                      Pour contribuer ou créer une campagne, l’accès se fait via un compte vérifié.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="card border-0 fc-surface-card mb-5">
        <div className="card-body p-4 p-md-5">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
            <div>
              <h2 className="h5 mb-1 fw-bold text-dark">Comment ça marche ?</h2>
              <p className="text-muted small mb-0">
                Un parcours simple, avec des règles claires et des statuts lisibles.
              </p>
            </div>
          </div>

          <div className="vstack gap-4">
            <div className="fc-step">
              <span className="fc-step__num" aria-hidden="true">
                1
              </span>
              <div>
                <div className="fw-semibold text-dark mb-1">Créer et vérifier votre compte</div>
                <p className="small text-muted mb-0">
                  Pour sécuriser la plateforme, la création de compte est confirmée par e-mail.
                </p>
              </div>
            </div>
            <div className="fc-step">
              <span className="fc-step__num" aria-hidden="true">
                2
              </span>
              <div>
                <div className="fw-semibold text-dark mb-1">Soumettre une campagne</div>
                <p className="small text-muted mb-0">
                  Les campagnes passent par une analyse automatique puis une revue avant publication.
                  Le créateur reçoit des notifications à chaque étape.
                </p>
              </div>
            </div>
            <div className="fc-step">
              <span className="fc-step__num" aria-hidden="true">
                3
              </span>
              <div>
                <div className="fw-semibold text-dark mb-1">Publier, contribuer, et suivre</div>
                <p className="small text-muted mb-0">
                  Une fois publiée, une campagne devient visible au public. Les contributeurs suivent le résultat
                  et reçoivent les confirmations dans l’application.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card border-0 fc-surface-card mb-5">
        <div className="card-body p-4 p-md-5">
          <h2 className="h5 mb-3 fw-bold text-dark">Politiques & droits des utilisateurs</h2>
          <div className="row g-4">
            <div className="col-md-6">
              <div className="d-flex gap-3">
                <div className="fc-feature-icon">
                  <i className="fa-solid fa-scale-balanced" aria-hidden="true" />
                </div>
                <div>
                  <div className="fw-semibold text-dark mb-1">Transparence</div>
                  <div className="small text-muted">
                    Chaque campagne affiche son objectif, ses dates, et son statut. Les changements
                    importants déclenchent des notifications.
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
                    Une campagne n’est publique qu’après contrôle. Les administrateurs gèrent la
                    publication, les signalements et les opérations techniques.
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
                    En cas d’expiration ou d’annulation, le système tente automatiquement les
                    remboursements. Si une action échoue, elle est relançable côté Ops.
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
                    Vous contrôlez vos informations de profil. Les données sensibles (ex. coordonnées
                    bancaires pour payout) sont chiffrées côté serveur.
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
                    Tout utilisateur peut signaler une campagne. L’administration traite et décide :
                    résolution ou rejet, avec traçabilité.
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
                  <div className="fw-semibold text-dark mb-1">Engagement utilisateur</div>
                  <div className="small text-muted">
                    Votre droit principal : comprendre. Les statuts et messages sont rédigés pour des
                    utilisateurs non techniques, avec une visibilité claire en cas de blocage.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
