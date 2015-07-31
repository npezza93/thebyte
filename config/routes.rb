TheByte::Application.routes.draw do
  get 'media_manager/retrieve'
  post 'media_manager/delete'
  post 'media_manager/file_upload'

  resources :posts do
    resources :comments, :only => [:create]
  end

  resources :users, except: [:show, :new] do
    resources :avatars, :only => [:edit]
  end

  resources :password_resets
  
  controller :sessions do
    post 'login'    => :create 
    delete 'logout' => :destroy
  end
  
  # The priority is based upon order of creation: first created -> highest priority.
  # See how all your routes lay out with "rake routes".

  # You can have the root of your site routed with "root"
  root 'posts#index'
end
